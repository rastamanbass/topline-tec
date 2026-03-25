import {
  runTransaction,
  doc,
  increment,
  collection,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { phoneLabel } from '../../lib/phoneUtils';
import type { Phone, Client, PurchaseItem, Repair } from '../../types';

export interface SaleData {
  items: PurchaseItem[];
  totalAmount: number;
  paymentMethod: string;
  clientId: string;
  discountAmount?: number;
  debtIncurred?: number;
  amountPaidWithCredit: number;
  amountPaidWithWorkshopDebt: number;
  transferDetails?: {
    number: string;
    name: string;
    bank: string;
  };
  notes?: string;
}

export const executeSaleTransaction = async (saleData: SaleData, allPhones: Phone[]) => {
  const clientRef = saleData.clientId ? doc(db, 'clients', saleData.clientId) : null;

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Read Client Data
      let clientName = 'Venta en efectivo';
      let currentCredit = 0;

      if (clientRef) {
        const clientDoc = await transaction.get(clientRef);
        if (!clientDoc.exists()) throw new Error('Cliente no encontrado.');

        const clientData = clientDoc.data() as Client;
        clientName = clientData.name;
        currentCredit = clientData.creditAmount || 0;

        if (saleData.amountPaidWithCredit > currentCredit) {
          throw new Error('Crédito insuficiente.');
        }
      } else {
        if (saleData.amountPaidWithCredit > 0) {
          throw new Error('No se puede usar crédito sin un cliente seleccionado.');
        }
        if (saleData.debtIncurred && saleData.debtIncurred > 0) {
          throw new Error('No se puede generar deuda sin un cliente seleccionado.');
        }
      }

      // 2. Prepare Workshop Debt Payment (if applicable)
      let debtToPay = saleData.amountPaidWithWorkshopDebt;
      const pendingRepairsToProcess: { phoneId: string; repairIndex: number; cost: number }[] = [];
      // Note: We need to read the phones involved in repairs to update them transactionally.
      // Ideally, the UI passes the specific phone IDs, but here we might need to scan if not provided.
      // Optimally, we pass the phones map or similar. For now, assuming `allPhones` helps us find them
      // BUT we must read them inside transaction to be safe or ensure optimistic UI handles it.
      // To keep it simple and safe: We will only read the phones that are being *Sold* in this transaction for update,
      // and separately scan for workshop debt phones if needed.

      // However, Firestore transactions require all reads before writes.
      // If we are paying workshop debt, we need to find which repairs to pay.
      // This logic from legacy code scans *all* phones in memory (`allPhones`) to find unpaid repairs.
      // In a real app with thousands of phones, this scan should be done via a Query, but `runTransaction`
      // doesn't support running queries easily mid-transaction unless we know IDs.
      // Strategy: We will assume the UI has identified which repairs to pay OR we do a pre-calc.
      // For this migration, I will follow the legacy pattern: iterate `allPhones` (which we might not have full access to here inside the service without passing it).
      // Passed `allPhones` as argument to solve this matching legacy behavior.

      const phoneDocsToRead = new Map<string, Record<string, unknown>>();

      if (debtToPay > 0 && allPhones.length > 0) {
        // Use cache ONLY for phone ID discovery
        const candidatePhoneIds = new Set<string>();
        for (const phone of allPhones) {
          if (phone.reparaciones?.some((r) => !r.paid && r.cost > 0)) {
            candidatePhoneIds.add(phone.id);
          }
        }

        // Read these phones inside the transaction for fresh data
        for (const pid of candidatePhoneIds) {
          const pRef = doc(db, 'phones', pid);
          const pDoc = await transaction.get(pRef);
          if (pDoc.exists()) {
            phoneDocsToRead.set(pid, pDoc.data());
          }
        }

        // Build pending repairs list from FRESH transaction data
        const allPendingRepairs: {
          phoneId: string;
          repairIndex: number;
          cost: number;
          date: Date;
        }[] = [];

        phoneDocsToRead.forEach((data, phoneId) => {
          const repairs = data.reparaciones as Repair[] | undefined;
          if (repairs) {
            repairs.forEach((repair, index) => {
              if (!repair.paid && repair.cost > 0) {
                const repairDate =
                  repair.date instanceof Date
                    ? repair.date
                    : (repair.date as { toDate: () => Date }).toDate();
                allPendingRepairs.push({
                  phoneId,
                  repairIndex: index,
                  cost: repair.cost,
                  date: repairDate,
                });
              }
            });
          }
        });

        allPendingRepairs.sort((a, b) => a.date.getTime() - b.date.getTime());

        for (const repair of allPendingRepairs) {
          if (debtToPay <= 0) break;
          if (debtToPay >= repair.cost) {
            pendingRepairsToProcess.push(repair);
            debtToPay -= repair.cost;
          }
        }
      }

      // Also read the phones being SOLD
      for (const item of saleData.items) {
        if (item.phoneId) {
          if (!phoneDocsToRead.has(item.phoneId)) {
            const pRef = doc(db, 'phones', item.phoneId);
            const pDoc = await transaction.get(pRef);
            if (!pDoc.exists()) throw new Error(`Phone ${item.phoneId} being sold not found.`);
            phoneDocsToRead.set(item.phoneId, pDoc.data());
          }
        }
      }

      // Atomic availability check — prevents double-selling
      for (const item of saleData.items) {
        if (item.phoneId) {
          const currentData = phoneDocsToRead.get(item.phoneId);
          if (!currentData) throw new Error(`Teléfono ${item.phoneId} no encontrado.`);

          const currentEstado = currentData.estado as string;
          const reservation = currentData.reservation as
            | { reservedBy: string; expiresAt: number }
            | null
            | undefined;

          // Available if: En Stock, OR the POS_SALE reservation is ours
          const isAvailable =
            currentEstado === 'En Stock (Disponible para Venta)' ||
            reservation?.reservedBy === 'POS_SALE';

          if (!isAvailable) {
            const marca = (currentData.marca as string) || '';
            const modelo = (currentData.modelo as string) || '';
            const phoneInfo = phoneLabel(marca, modelo) || item.phoneId;
            throw new Error(
              `"${phoneInfo}" ya no está disponible (estado: ${currentEstado}). Por favor recarga el inventario.`
            );
          }

          // Guard B2B: rechazar si hay una reserva B2B activa y no expirada.
          // Esto previene doble-venta cuando un comprador online y un vendedor POS
          // presionan "Confirmar" simultáneamente sobre el mismo teléfono.
          const now = Date.now();
          const hasActiveB2BReservation =
            reservation != null &&
            reservation.reservedBy !== 'POS_SALE' &&
            reservation.expiresAt != null &&
            reservation.expiresAt > now;

          if (hasActiveB2BReservation) {
            const marca = (currentData.marca as string) || '';
            const modelo = (currentData.modelo as string) || '';
            const phoneInfo = phoneLabel(marca, modelo) || item.phoneId;
            const expireTime = new Date(reservation!.expiresAt).toLocaleTimeString('es-SV');
            throw new Error(
              `"${phoneInfo}" está reservado por un comprador online hasta las ${expireTime}. ` +
                `Espera a que expire la reserva o coordina con el comprador.`
            );
          }
        }
      }

      // --- WRITES ---

      const round2 = (n: number) => Math.round(n * 100) / 100;

      // 3. Update Client Credit/Debt
      if (saleData.amountPaidWithCredit > 0 && clientRef) {
        transaction.update(clientRef, {
          creditAmount: increment(-round2(saleData.amountPaidWithCredit)),
        });
      }
      if (saleData.debtIncurred && saleData.debtIncurred > 0 && clientRef) {
        transaction.update(clientRef, { debtAmount: increment(round2(saleData.debtIncurred)) });
      }

      // 4. Update Workshop Repairs (mark as paid)
      if (pendingRepairsToProcess.length > 0) {
        const updatedPhoneRepairs = new Map<string, Repair[]>();

        for (const pending of pendingRepairsToProcess) {
          const pid = pending.phoneId;
          if (!updatedPhoneRepairs.has(pid)) {
            const originalData = phoneDocsToRead.get(pid);
            const existingRepairs = Array.isArray(originalData?.reparaciones)
              ? (originalData.reparaciones as Repair[])
              : [];
            updatedPhoneRepairs.set(pid, [...existingRepairs]);
          }
          const repairs = updatedPhoneRepairs.get(pid);
          if (repairs && repairs[pending.repairIndex]) {
            repairs[pending.repairIndex].paid = true;
          }
        }

        updatedPhoneRepairs.forEach((reparaciones, phoneId) => {
          const phoneRef = doc(db, 'phones', phoneId);
          transaction.update(phoneRef, { reparaciones });
        });
      }

      // 5. Create Purchase Record
      if (saleData.clientId) {
        const purchaseRef = doc(collection(db, 'clients', saleData.clientId, 'purchases'));
        // Build per-item discount summary
        const itemDiscounts = saleData.items
          .filter((item) => item.originalPrice != null && item.originalPrice !== item.price)
          .map((item) => ({
            imei: item.imei || '',
            description: item.description,
            originalPrice: item.originalPrice!,
            finalPrice: item.price,
            discount: round2(item.originalPrice! - item.price),
            reason: item.discountReason || '',
            approvedBy: item.discountApprovedBy || '',
          }));

        transaction.set(purchaseRef, {
          items: saleData.items,
          totalAmount: round2(saleData.totalAmount),
          paymentMethod: saleData.paymentMethod,
          discountAmount: round2(saleData.discountAmount || 0),
          debtIncurred: round2(saleData.debtIncurred || 0),
          amountPaidWithCredit: round2(saleData.amountPaidWithCredit),
          amountPaidWithWorkshopDebt: round2(saleData.amountPaidWithWorkshopDebt),
          transferDetails: saleData.transferDetails || null,
          notes: saleData.notes || null,
          itemDiscounts: itemDiscounts.length > 0 ? itemDiscounts : null,
          purchaseDate: serverTimestamp(),
        });
      }

      // 6. Update Inventory (Phones Sold)
      for (const item of saleData.items) {
        if (item.phoneId) {
          const phoneRef = doc(db, 'phones', item.phoneId);
          // We read it earlier, so we can check it if we want, but update is safe
          const historyEntry = {
            newStatus: 'Vendido',
            date: new Date(),
            user: auth.currentUser?.email || 'unknown',
            details: `Vendido a ${clientName}`,
          };

          // Need to get existing history to append?
          // transaction.update with arrayUnion is cleaner for history
          // But we also need to set fields.

          transaction.update(phoneRef, {
            estado: 'Vendido',
            clienteId: saleData.clientId || null,
            precioVenta: item.price,
            fechaVenta: new Date().toISOString().slice(0, 10), // Legacy format YYYY-MM-DD
            statusHistory: arrayUnion(historyEntry),
            reservation: null,
          });
        } else if (item.accessoryId) {
          const accRef = doc(db, 'accessories', item.accessoryId);
          transaction.update(accRef, { cantidad: increment(-item.quantity) });
        }
      }
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('Transaction failed: ', error);
    return { success: false, error: (error as Error).message };
  }
};
