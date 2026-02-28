import { useQuery } from '@tanstack/react-query';
import { collection, getDocs, query, orderBy, collectionGroup } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Purchase, Client } from '../../../types';

export interface SaleRecord extends Purchase {
  clientName: string;
  clientId: string;
}

export function useSalesHistory() {
  return useQuery({
    queryKey: ['sales-history'],
    queryFn: async () => {
      // Fetch all clients first
      const clientsSnap = await getDocs(collection(db, 'clients'));
      const clientMap = new Map<string, string>();
      clientsSnap.docs.forEach((d) => {
        const data = d.data() as Client;
        clientMap.set(d.id, data.name);
      });

      // Use collectionGroup to get ALL purchases across all clients
      const purchasesQuery = query(
        collectionGroup(db, 'purchases'),
        orderBy('purchaseDate', 'desc')
      );
      const purchasesSnap = await getDocs(purchasesQuery);

      return purchasesSnap.docs.map((d) => {
        // Parent path: clients/{clientId}/purchases/{purchaseId}
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
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
