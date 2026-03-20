import { useState, useEffect } from 'react';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Phone } from '../../../types';

export function usePublicPhones() {
  const [data, setData] = useState<Phone[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const phonesRef = collection(db, 'phones');
    const q = query(
      phonesRef,
      where('estado', 'in', ['En Stock (Disponible para Venta)', 'Apartado']),
      limit(200)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const phones = snapshot.docs
        .map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            }) as Phone
        )
        .sort((a, b) => {
          const toMs = (v: unknown): number => {
            if (!v) return 0;
            if (typeof (v as { toMillis?: () => number }).toMillis === 'function')
              return (v as { toMillis: () => number }).toMillis();
            if (v instanceof Date) return v.getTime();
            if (typeof v === 'string') return new Date(v).getTime();
            return 0;
          };
          return toMs(b.fechaIngreso) - toMs(a.fechaIngreso);
        });

      setData(phones);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { data, isLoading };
}
