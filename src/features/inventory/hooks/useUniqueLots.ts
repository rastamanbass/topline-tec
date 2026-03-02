import { useQuery } from '@tanstack/react-query';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export interface LotOption {
  name: string;
  count: number;
}

export function useUniqueLots() {
  return useQuery({
    queryKey: ['unique-lots'],
    queryFn: async (): Promise<LotOption[]> => {
      const snap = await getDocs(collection(db, 'phones'));
      const lotMap = new Map<string, number>();
      snap.forEach(d => {
        const lote = (d.data().lote as string || '').trim();
        if (lote) lotMap.set(lote, (lotMap.get(lote) || 0) + 1);
      });
      return Array.from(lotMap.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
