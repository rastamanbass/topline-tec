import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import type { Phone, Repair } from '../../../types';

export function useWorkshopPhones() {
  return useQuery({
    queryKey: ['workshop-phones'],
    queryFn: async () => {
      // Find all phones where status indicates workshop
      const statuses = [
        'Enviado a Taller (Garantía)',
        'Enviado a Taller (Externo)',
        'En Taller (Recibido)',
        'Recibido de Taller (OK)',
      ];

      const q = query(collection(db, 'phones'), where('estado', 'in', statuses));

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Phone[];
    },
  });
}

export function useAddRepairTicket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ phoneId, repair }: { phoneId: string; repair: Repair }) => {
      const phoneRef = doc(db, 'phones', phoneId);

      // Update status to 'En Taller (Recibido)' or 'Enviado...' depending on context?
      // Use default or passed status logic.
      // Usually creating a ticket implies sending to workshop.

      await updateDoc(phoneRef, {
        reparaciones: arrayUnion(repair),
        estado: 'En Taller (Recibido)',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-phones'] });
      queryClient.invalidateQueries({ queryKey: ['phones'] });
    },
  });
}

export function useUpdateWorkshopStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      newStatus,
      details,
    }: {
      id: string;
      newStatus: string;
      details?: string;
    }) => {
      const phoneRef = doc(db, 'phones', id);

      // Get current history to append
      // In a real app we might use arrayUnion directly if we construct the object perfectly,
      // but we need 'user' from auth state. arrayUnion is cleaner if we can get user here.

      const historyEntry = {
        newStatus,
        date: new Date(),
        user: auth.currentUser?.email || 'unknown',
        details: details || null,
      };

      await updateDoc(phoneRef, {
        estado: newStatus,
        statusHistory: arrayUnion(historyEntry),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workshop-phones'] });
      queryClient.invalidateQueries({ queryKey: ['phones'] });
      // toast success handled in UI or here? Let's add it here for consistency
    },
  });
}
