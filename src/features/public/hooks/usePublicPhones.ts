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
          const dateA = a.fechaIngreso instanceof Date ? a.fechaIngreso.getTime() : 0;
          const dateB = b.fechaIngreso instanceof Date ? b.fechaIngreso.getTime() : 0;
          return dateB - dateA;
        });

      setData(phones);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { data, isLoading };
}
