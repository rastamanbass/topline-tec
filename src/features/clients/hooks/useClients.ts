import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
  runTransaction,
  type Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import type { Client } from '../../../types';
import toast from 'react-hot-toast';

// Fetch all clients
export function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const q = query(collection(db, 'clients'), orderBy('name', 'asc'), limit(500));
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
        orderBy('purchaseDate', 'desc'),
        limit(200)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // Convert timestamp
        purchaseDate: (() => {
          const v = doc.data().purchaseDate;
          if (!v) return new Date();
          if (typeof v === 'string') return new Date(v);
          if (typeof v.toDate === 'function') return v.toDate();
          return new Date();
        })(),
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

// Record a client debt payment (atomic transaction)
export function useRecordDebtPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clientId,
      amount,
      paymentMethod,
      reference,
      notes,
    }: {
      clientId: string;
      amount: number;
      paymentMethod: 'Efectivo' | 'Transferencia' | 'Cheque' | 'Otro';
      reference?: string;
      notes?: string;
    }) => {
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const roundedAmount = round2(amount);
      if (roundedAmount <= 0) {
        throw new Error('El monto del pago debe ser mayor a $0.00');
      }
      const createdBy = auth.currentUser?.email || 'unknown';
      await runTransaction(db, async (transaction) => {
        const clientRef = doc(db, 'clients', clientId);
        const clientSnap = await transaction.get(clientRef);
        if (!clientSnap.exists()) throw new Error('Cliente no encontrado');
        const currentDebt = round2((clientSnap.data().debtAmount as number) || 0);
        if (roundedAmount > currentDebt + 0.001) {
          throw new Error(
            `El pago ($${roundedAmount.toFixed(2)}) excede la deuda actual ($${currentDebt.toFixed(2)})`
          );
        }
        // Use explicit value to prevent floating-point drift below zero
        const newDebt = round2(Math.max(0, currentDebt - roundedAmount));
        transaction.update(clientRef, {
          debtAmount: newDebt,
          updatedAt: serverTimestamp(),
        });
        const paymentRef = doc(collection(db, 'clients', clientId, 'debtPayments'));
        transaction.set(paymentRef, {
          amount: roundedAmount,
          paymentMethod,
          reference: reference || null,
          notes: notes || null,
          paidAt: serverTimestamp(),
          createdBy,
        });
      });
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['debt-history', vars.clientId] });
      toast.success('Pago registrado correctamente');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
}

// Fetch unified debt history (payments + adjustments)
export interface DebtHistoryEntry {
  id: string;
  type: 'payment' | 'adjustment';
  amount: number;
  date: Date;
  // payment fields
  paymentMethod?: string;
  reference?: string;
  notes?: string;
  createdBy?: string;
  // adjustment fields
  reason?: string;
  adjustedBy?: string;
}

const toDate = (v: unknown): Date => {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof v === 'string') return new Date(v);
  if (typeof (v as Timestamp).toDate === 'function') return (v as Timestamp).toDate();
  return new Date();
};

export function useDebtHistory(clientId: string) {
  return useQuery({
    queryKey: ['debt-history', clientId],
    queryFn: async (): Promise<DebtHistoryEntry[]> => {
      const [paymentsSnap, adjustmentsSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, 'clients', clientId, 'debtPayments'),
            orderBy('paidAt', 'desc'),
            limit(500)
          )
        ),
        getDocs(
          query(
            collection(db, 'clients', clientId, 'debtAdjustments'),
            orderBy('adjustedAt', 'desc'),
            limit(500)
          )
        ),
      ]);

      const payments: DebtHistoryEntry[] = paymentsSnap.docs.map((d) => ({
        id: d.id,
        type: 'payment',
        amount: d.data().amount as number,
        date: toDate(d.data().paidAt),
        paymentMethod: d.data().paymentMethod as string,
        reference: d.data().reference as string | undefined,
        notes: d.data().notes as string | undefined,
        createdBy: d.data().createdBy as string | undefined,
      }));

      const adjustments: DebtHistoryEntry[] = adjustmentsSnap.docs.map((d) => ({
        id: d.id,
        type: 'adjustment',
        amount: d.data().amount as number,
        date: toDate(d.data().adjustedAt),
        reason: d.data().reason as string | undefined,
        adjustedBy: d.data().adjustedBy as string | undefined,
      }));

      return [...payments, ...adjustments].sort(
        (a, b) => b.date.getTime() - a.date.getTime()
      );
    },
    enabled: !!clientId,
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
