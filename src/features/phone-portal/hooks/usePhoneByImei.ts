import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Phone } from '../../../types';

export function buildPhoneQuery(raw: string): string | null {
  const digits = raw.trim().replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (digits.length === 16 && digits[0] === '1') return digits.substring(1);
  return digits;
}

export function usePhoneByImei(rawImei: string) {
  const normalizedImei = buildPhoneQuery(rawImei);
  return useQuery({
    queryKey: ['phone-by-imei', normalizedImei],
    enabled: !!normalizedImei,
    queryFn: async (): Promise<Phone | null> => {
      if (!normalizedImei) return null;
      const q = query(collection(db, 'phones'), where('imei', '==', normalizedImei), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { id: d.id, ...d.data() } as Phone;
    },
    staleTime: 30_000,
  });
}
