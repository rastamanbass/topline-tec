import { useMutation, useQueryClient } from '@tanstack/react-query';
import { executeSaleTransaction, type SaleData } from '../../../services/firebase/transactions';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Phone } from '../../../types';

export function useSaleTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (saleData: SaleData) => {
      // Attempt to get phones from cache to avoid extra read
      let allPhones = queryClient.getQueryData<Phone[]>(['phones', {}]);

      // If not in cache, we must fetch to ensure Workshop Debt logic works
      if (!allPhones) {
        const q = query(collection(db, 'phones'));
        const snapshot = await getDocs(q);
        allPhones = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Phone[];
      }

      return executeSaleTransaction(saleData, allPhones || []);
    },
  });
}
