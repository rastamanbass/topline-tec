import { useQuery } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  collectionGroup,
  where,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Purchase, Client, Phone } from '../../../types';

export interface SaleRecord extends Purchase {
  clientName: string;
  clientId: string;
  invoiceId?: string;
}

// Convert a phone doc into a SaleRecord-compatible shape
function phoneToSaleRecord(phone: Phone, clientMap: Map<string, string>): SaleRecord {
  const purchaseDate = phone.fechaVenta
    ? new Date(phone.fechaVenta)
    : new Date();

  return {
    id: phone.id,
    clientId: phone.clienteId || '',
    clientName: (phone.clienteId && clientMap.get(phone.clienteId)) || 'Venta directa',
    purchaseDate,
    totalAmount: phone.precioVenta || 0,
    paymentMethod: 'N/A',
    discountAmount: 0,
    debtIncurred: 0,
    amountPaidWithCredit: 0,
    amountPaidWithWorkshopDebt: 0,
    items: [
      {
        description: `${phone.marca || ''} ${phone.modelo || ''} ${phone.storage || ''}`.trim(),
        imei: phone.imei,
        price: phone.precioVenta || 0,
        quantity: 1,
      },
    ],
  } as SaleRecord;
}

export function useSalesHistory() {
  return useQuery({
    queryKey: ['sales-history'],
    queryFn: async () => {
      // 1. Fetch clients for name lookup
      const clientsSnap = await getDocs(query(collection(db, 'clients'), limit(500)));
      const clientMap = new Map<string, string>();
      clientsSnap.docs.forEach((d) => {
        const data = d.data() as Client;
        clientMap.set(d.id, data.name);
      });

      // 2. Try purchases subcollection first (new sales from POS)
      let purchaseRecords: SaleRecord[] = [];
      try {
        const purchasesQuery = query(
          collectionGroup(db, 'purchases'),
          orderBy('purchaseDate', 'desc'),
          limit(500)
        );
        const purchasesSnap = await getDocs(purchasesQuery);

        purchaseRecords = purchasesSnap.docs.map((d) => {
          const clientId = d.ref.parent.parent?.id || '';
          const rawDate = d.data().purchaseDate;
          let purchaseDate: Date;
          if (!rawDate) {
            purchaseDate = new Date();
          } else if (typeof rawDate === 'string') {
            purchaseDate = new Date(rawDate);
          } else if (typeof rawDate.toDate === 'function') {
            purchaseDate = rawDate.toDate();
          } else {
            purchaseDate = new Date();
          }

          return {
            id: d.id,
            clientId,
            clientName: clientMap.get(clientId) || 'Cliente desconocido',
            ...d.data(),
            purchaseDate,
          } as SaleRecord;
        });
      } catch {
        // collectionGroup query may fail if no index exists — fall through
      }

      // 3. Also fetch sold phones (covers legacy sales not in purchases subcollection)
      const soldStates = ['Vendido', 'Pagado', 'Entregado al Cliente', 'Vendido (Pendiente de Entrega)'];
      const phonesQuery = query(
        collection(db, 'phones'),
        where('estado', 'in', soldStates),
        orderBy('fechaVenta', 'desc'),
        limit(500)
      );
      const phonesSnap = await getDocs(phonesQuery);

      // Build set of IMEIs already covered by purchase records
      const coveredImeis = new Set<string>();
      purchaseRecords.forEach((pr) => {
        pr.items?.forEach((item) => {
          if (item.imei) coveredImeis.add(item.imei);
        });
      });

      // Add phone-based records for phones not already in purchase records
      const phoneRecords: SaleRecord[] = [];
      phonesSnap.docs.forEach((d) => {
        const phone = { id: d.id, ...d.data() } as Phone;
        if (!coveredImeis.has(phone.imei)) {
          phoneRecords.push(phoneToSaleRecord(phone, clientMap));
        }
      });

      // 4. Merge and sort by date descending
      const all = [...purchaseRecords, ...phoneRecords].sort(
        (a, b) => b.purchaseDate.getTime() - a.purchaseDate.getTime()
      );

      return all;
    },
    staleTime: 2 * 60 * 1000,
  });
}
