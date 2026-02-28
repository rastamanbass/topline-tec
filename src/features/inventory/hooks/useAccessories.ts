import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
// We need an Accessory type. Since it wasn't in index.ts explicitely as a standalone interface (only PurchaseItem reference),
// I will assume/add one. The legacy code uses: { id, nombre, tipo, cantidad, costo, precioVenta }

export interface Accessory {
  id: string;
  nombre: string;
  tipo: 'Repuesto' | 'Regalía';
  cantidad: number;
  costo: number;
  precioVenta: number;
}

// Fetch all accessories
export function useAccessories() {
  return useQuery({
    queryKey: ['accessories'],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, 'accessories'));
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Accessory[];
    },
  });
}

// Create accessory
export function useCreateAccessory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: Omit<Accessory, 'id'>) => {
      const docRef = await addDoc(collection(db, 'accessories'), {
        ...item,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessories'] });
    },
  });
}

// Update accessory
export function useUpdateAccessory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Accessory> }) => {
      const ref = doc(db, 'accessories', id);
      await updateDoc(ref, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessories'] });
    },
  });
}

// Delete accessory
export function useDeleteAccessory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'accessories', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessories'] });
    },
  });
}
