import { useMutation, useQueryClient } from '@tanstack/react-query';
import { executeSaleTransaction, type SaleData } from '../../../services/firebase/transactions';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Phone } from '../../../types';

export function useSaleTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (saleData: SaleData) => {
      let allPhones: Phone[] = [];

      if (saleData.amountPaidWithWorkshopDebt > 0) {
        const cached = queryClient.getQueryData<Phone[]>(['phones', {}]);
        if (cached) {
          allPhones = cached;
        } else {
          const q = query(collection(db, 'phones'), where('reparaciones', '!=', null));
          const snapshot = await getDocs(q);
          allPhones = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Phone[];
        }
      }

      return executeSaleTransaction(saleData, allPhones);
    },
  });
}
