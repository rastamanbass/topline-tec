import {
  runTransaction,
  doc,
  increment,
  collection,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
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
  const clientRef = doc(db, 'clients', saleData.clientId);

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Read Client Data
      const clientDoc = await transaction.get(clientRef);
      if (!clientDoc.exists()) throw new Error('Cliente no encontrado.');

      const clientData = clientDoc.data() as Client;
      const clientName = clientData.name;
      const currentCredit = clientData.creditAmount || 0;

      if (saleData.amountPaidWithCredit > currentCredit) {
        throw new Error('Crédito insuficiente.');
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

      if (debtToPay > 0) {
        const allPendingRepairs: {
          phoneId: string;
          repairIndex: number;
          cost: number;
          date: Date;
        }[] = [];

        allPhones.forEach((phone) => {
          if (phone.reparaciones && phone.reparaciones.length > 0) {
            phone.reparaciones.forEach((repair, index) => {
              if (!repair.paid && repair.cost > 0) {
                // Convert timestamps if needed
                const repairDate =
                  repair.date instanceof Date
                    ? repair.date
                    : (repair.date as { toDate: () => Date }).toDate();
                allPendingRepairs.push({
                  phoneId: phone.id,
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

        // Read these phones for transaction
        const phoneIdsToRead = [...new Set(pendingRepairsToProcess.map((p) => p.phoneId))];
        for (const pid of phoneIdsToRead) {
          const pRef = doc(db, 'phones', pid);
          const pDoc = await transaction.get(pRef);
          if (!pDoc.exists()) throw new Error(`Phone ${pid} for repair payment not found.`);
          phoneDocsToRead.set(pid, pDoc.data());
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

      // --- WRITES ---

      // 3. Update Client Credit/Debt
      if (saleData.amountPaidWithCredit > 0) {
        transaction.update(clientRef, { creditAmount: increment(-saleData.amountPaidWithCredit) });
      }
      if (saleData.debtIncurred && saleData.debtIncurred > 0) {
        transaction.update(clientRef, { debtAmount: increment(saleData.debtIncurred) });
      }

      // 4. Update Workshop Repairs (mark as paid)
      if (pendingRepairsToProcess.length > 0) {
        const updatedPhoneRepairs = new Map<string, Repair[]>();

        for (const pending of pendingRepairsToProcess) {
          const pid = pending.phoneId;
          if (!updatedPhoneRepairs.has(pid)) {
            const originalData = phoneDocsToRead.get(pid);
            updatedPhoneRepairs.set(pid, [...(originalData.reparaciones || [])]);
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
      const purchaseRef = doc(collection(db, 'clients', saleData.clientId, 'purchases'));
      transaction.set(purchaseRef, {
        items: saleData.items,
        totalAmount: saleData.totalAmount,
        paymentMethod: saleData.paymentMethod,
        discountAmount: saleData.discountAmount || 0,
        debtIncurred: saleData.debtIncurred || 0,
        amountPaidWithCredit: saleData.amountPaidWithCredit,
        amountPaidWithWorkshopDebt: saleData.amountPaidWithWorkshopDebt,
        transferDetails: saleData.transferDetails || null,
        notes: saleData.notes || null,
        purchaseDate: serverTimestamp(),
      });

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
            clienteId: saleData.clientId,
            precioVenta: item.price,
            fechaVenta: new Date().toISOString().slice(0, 10), // Legacy format YYYY-MM-DD
            statusHistory: arrayUnion(historyEntry),
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
