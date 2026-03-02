import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Invoice } from '../../../types';

/**
 * Fetches recent invoices and returns a Map keyed by invoiceId for lookup.
 * Also returns a Map from purchaseId -> invoiceId for matching with sales history.
 */
export function useRecentInvoicesMap() {
  return useQuery({
    queryKey: ['invoices-map'],
    queryFn: async () => {
      const q = query(
        collection(db, 'invoices'),
        orderBy('issuedAt', 'desc'),
        limit(500)
      );
      const snap = await getDocs(q);

      const byId = new Map<string, Invoice>();
      const purchaseToInvoice = new Map<string, string>(); // purchaseId -> invoiceId

      snap.docs.forEach((d) => {
        const data = d.data() as Omit<Invoice, 'id'>;
        const inv: Invoice = { id: d.id, ...data };
        byId.set(d.id, inv);
        if (data.purchaseId) {
          purchaseToInvoice.set(data.purchaseId, d.id);
        }
      });

      return { byId, purchaseToInvoice };
    },
    staleTime: 2 * 60 * 1000,
  });
}
