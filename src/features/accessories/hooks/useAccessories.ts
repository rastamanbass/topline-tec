import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import toast from 'react-hot-toast';

export interface Accessory {
  id: string;
  name: string;
  category: string;
  brand?: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  minStock: number;
  sku?: string;
  isActive: boolean;
  updatedAt?: Date;
}

export type AccessoryInput = Omit<Accessory, 'id' | 'updatedAt'>;

const CATEGORIES = [
  'Cables',
  'Cargadores',
  'Cases',
  'Protectores',
  'Audífonos',
  'Baterías',
  'Otros',
];
export { CATEGORIES };

export function useAccessories() {
  return useQuery({
    queryKey: ['accessories'],
    queryFn: async () => {
      const q = query(collection(db, 'accessories'), orderBy('name', 'asc'));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Accessory[];
    },
  });
}

export function useCreateAccessory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: AccessoryInput) => {
      await addDoc(collection(db, 'accessories'), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessories'] });
      toast.success('Accesorio creado');
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });
}

export function useUpdateAccessory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<AccessoryInput> }) => {
      await updateDoc(doc(db, 'accessories', id), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessories'] });
      toast.success('Accesorio actualizado');
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });
}

export function useDeleteAccessory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'accessories', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accessories'] });
      toast.success('Accesorio eliminado');
    },
    onError: (err: Error) => toast.error(`Error: ${err.message}`),
  });
}
