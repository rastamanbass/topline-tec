import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import type { Phone, PhoneStatus } from '../../../types';
import toast from 'react-hot-toast';

// Filters interface
export interface PhoneFilters {
  lot?: string | null;
  status?: PhoneStatus | null;
  searchQuery?: string;
}

// Convert Firestore Timestamp to Date
const convertTimestamp = (timestamp: Timestamp | Date): Date => {
  if (timestamp instanceof Date) return timestamp;
  return timestamp.toDate();
};

// Fetch all phones with optional filters
export function usePhones(filters: PhoneFilters = {}) {
  return useQuery({
    queryKey: ['phones', filters],
    queryFn: async () => {
      let q = query(collection(db, 'phones'), orderBy('fechaIngreso', 'desc'));

      // Apply lot filter
      if (filters.lot) {
        q = query(q, where('lote', '==', filters.lot));
      }

      // Apply status filter
      if (filters.status) {
        q = query(q, where('estado', '==', filters.status));
      }

      const snapshot = await getDocs(q);
      let phones = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          fechaIngreso: data.fechaIngreso ? convertTimestamp(data.fechaIngreso) : new Date(),
          fechaVenta: data.fechaVenta ? convertTimestamp(data.fechaVenta) : undefined,
          updatedAt: data.updatedAt ? convertTimestamp(data.updatedAt) : undefined,
        } as Phone;
      });

      // Client-side search filter (for IMEI and modelo)
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        phones = phones.filter(
          (phone) =>
            phone.imei.toLowerCase().includes(query) ||
            phone.modelo.toLowerCase().includes(query) ||
            phone.marca.toLowerCase().includes(query)
        );
      }

      return phones;
    },
  });
}

// Create new phone
export function useCreatePhone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (phone: Omit<Phone, 'id' | 'fechaIngreso' | 'statusHistory'>) => {
      const docRef = await addDoc(collection(db, 'phones'), {
        ...phone,
        fechaIngreso: serverTimestamp(),
        createdBy: auth.currentUser?.uid,
        updatedAt: serverTimestamp(),
        statusHistory: [
          {
            newStatus: phone.estado,
            date: new Date(), // Use Date instead of serverTimestamp in arrays
            user: auth.currentUser?.email || 'unknown',
            details: 'Teléfono creado',
          },
        ],
      });
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phones'] });
      toast.success('Teléfono creado exitosamente');
    },
    onError: (error: Error) => {
      console.error('Create phone error:', error);
      toast.error(`Error al crear teléfono: ${error.message}`);
    },
  });
}

// Update existing phone
export function useUpdatePhone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Phone> }) => {
      const phoneRef = doc(db, 'phones', id);
      await updateDoc(phoneRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phones'] });
      toast.success('Teléfono actualizado exitosamente');
    },
    onError: (error: Error) => {
      console.error('Update phone error:', error);
      toast.error(`Error al actualizar teléfono: ${error.message}`);
    },
  });
}

// Delete phone
export function useDeletePhone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'phones', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phones'] });
      toast.success('Teléfono eliminado exitosamente');
    },
    onError: (error: Error) => {
      console.error('Delete phone error:', error);
      toast.error(`Error al eliminar teléfono: ${error.message}`);
    },
  });
}

// Change phone status
export function useChangePhoneStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      newStatus,
      details,
    }: {
      id: string;
      newStatus: PhoneStatus;
      details?: string;
    }) => {
      const phoneRef = doc(db, 'phones', id);

      // Fetch current phone to get statusHistory
      const phoneSnapshot = await getDocs(
        query(collection(db, 'phones'), where('__name__', '==', id))
      );
      const phone = phoneSnapshot.docs[0]?.data();

      const statusChange = {
        newStatus,
        date: new Date(), // Use Date instead of serverTimestamp in arrays
        user: auth.currentUser?.email || 'unknown',
        details,
      };

      await updateDoc(phoneRef, {
        estado: newStatus,
        updatedAt: serverTimestamp(),
        statusHistory: [...(phone?.statusHistory || []), statusChange],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phones'] });
      toast.success('Estado actualizado exitosamente');
    },
    onError: (error: Error) => {
      console.error('Change status error:', error);
      toast.error(`Error al cambiar estado: ${error.message}`);
    },
  });
}
