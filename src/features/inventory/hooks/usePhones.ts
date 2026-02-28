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
  setDoc,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import type { Phone, PhoneStatus } from '../../../types';
import toast from 'react-hot-toast';
import { saveDeviceDefinition } from '../services/deviceService';

// Filters interface
export interface PhoneFilters {
  lot?: string | null;
  status?: PhoneStatus | null;
  searchQuery?: string;
}

// Convert Firestore Timestamp | Date | string to Date (handles legacy string dates from prod)
const convertTimestamp = (timestamp: Timestamp | Date | string | unknown): Date => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'string') return new Date(timestamp);
  if (typeof (timestamp as Timestamp).toDate === 'function')
    return (timestamp as Timestamp).toDate();
  return new Date();
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
      // --- LEARNING: Save TAC definition ---
      if (phone.imei && phone.imei.length >= 8) {
        const tac = phone.imei.substring(0, 8);
        // Fire and forget (don't await to not block creation)
        saveDeviceDefinition(tac, phone.marca, phone.modelo);
      }
      // --- LEARNING: Save Price to Catalog ---
      if (phone.precioVenta > 0 && phone.modelo) {
        const storageVal = phone.storage || 'Unknown';
        // Composite Key: Apple-iPhone 13-128GB
        // Sanitize to avoid slash issues in ID
        const safeId = `${phone.marca}-${phone.modelo}-${storageVal}`
          .replace(/\//g, '-')
          .replace(/\s+/g, '-')
          .toLowerCase();

        const catalogRef = doc(db, 'price_catalog', safeId);
        // Fire and forget upsert
        setDoc(
          catalogRef,
          {
            brand: phone.marca,
            model: phone.modelo,
            storage: storageVal,
            averagePrice: phone.precioVenta,
            lastUpdated: new Date(),
            source: 'auto',
          },
          { merge: true }
        ).catch((err) => console.error('Failed to learn price', err));
      }
      // -------------------------------------

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
