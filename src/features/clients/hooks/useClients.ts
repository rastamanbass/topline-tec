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
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Client } from '../../../types';
import toast from 'react-hot-toast';

// Fetch all clients
export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const q = query(collection(db, 'clients'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Client[];
    },
  });
}

// Create new client
export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (client: Omit<Client, 'id'>) => {
      const docRef = await addDoc(collection(db, 'clients'), {
        ...client,
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente creado exitosamente');
    },
    onError: (error: Error) => {
      console.error('Create client error:', error);
      toast.error(`Error al crear cliente: ${error.message}`);
    },
  });
}

// Update existing client
export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Client> }) => {
      const clientRef = doc(db, 'clients', id);
      await updateDoc(clientRef, {
        ...data,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente actualizado exitosamente');
    },
    onError: (error: Error) => {
      console.error('Update client error:', error);
      toast.error(`Error al actualizar cliente: ${error.message}`);
    },
  });
}

// Delete client
export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await deleteDoc(doc(db, 'clients', id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente eliminado exitosamente');
    },
    onError: (error: Error) => {
      console.error('Delete client error:', error);
      toast.error(`Error al eliminar cliente: ${error.message}`);
    },
  });
}

// Fetch client purchases
export function useClientPurchases(clientId: string) {
  return useQuery({
    queryKey: ['client-purchases', clientId],
    queryFn: async () => {
      const q = query(
        collection(db, 'clients', clientId, 'purchases'),
        orderBy('purchaseDate', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // Convert timestamp
        purchaseDate: doc.data().purchaseDate?.toDate() || new Date(),
      }));
    },
    enabled: !!clientId,
  });
}

// Add credit adjustment audit trail
export function useAddCreditAdjustment() {
  return useMutation({
    mutationFn: async ({
      clientId,
      amount,
      reason,
      adjustedBy,
    }: {
      clientId: string;
      amount: number;
      reason: string;
      adjustedBy: string;
    }) => {
      const adjustmentRef = doc(collection(db, 'clients', clientId, 'creditAdjustments'));
      await setDoc(adjustmentRef, {
        amount,
        reason,
        adjustedBy,
        adjustedAt: serverTimestamp(),
      });
    },
  });
}

// Add debt adjustment audit trail
export function useAddDebtAdjustment() {
  return useMutation({
    mutationFn: async ({
      clientId,
      amount,
      reason,
      adjustedBy,
    }: {
      clientId: string;
      amount: number;
      reason: string;
      adjustedBy: string;
    }) => {
      const adjustmentRef = doc(collection(db, 'clients', clientId, 'debtAdjustments'));
      await setDoc(adjustmentRef, {
        amount,
        reason,
        adjustedBy,
        adjustedAt: serverTimestamp(),
      });
    },
  });
}
