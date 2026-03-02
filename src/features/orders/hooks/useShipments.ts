import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  addDoc,
  doc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Shipment, ShipmentStatus } from '../../../types';
import toast from 'react-hot-toast';

// ── Fetch all shipments (admin view) ─────────────────────────────────────────
export function useShipments() {
  return useQuery<Shipment[]>({
    queryKey: ['shipments'],
    queryFn: async () => {
      const q = query(
        collection(db, 'shipments'),
        orderBy('createdAt', 'desc'),
        limit(200)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Shipment));
    },
  });
}

// ── Fetch shipment for a specific order ──────────────────────────────────────
export function useOrderShipment(orderId: string) {
  return useQuery<Shipment | null>({
    queryKey: ['shipments', 'byOrder', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const q = query(
        collection(db, 'shipments'),
        where('orderId', '==', orderId),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const d = snap.docs[0];
      return { id: d.id, ...d.data() } as Shipment;
    },
    enabled: !!orderId,
  });
}

// ── Create a new shipment ─────────────────────────────────────────────────────
export function useCreateShipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shipment: Omit<Shipment, 'id' | 'createdAt' | 'updatedAt' | 'deliveredAt'>) => {
      const docRef = await addDoc(collection(db, 'shipments'), {
        ...shipment,
        status: 'preparando' as ShipmentStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('Envio creado correctamente');
    },
    onError: (error: Error) => {
      console.error('Create shipment error:', error);
      toast.error(`Error al crear envio: ${error.message}`);
    },
  });
}

// ── Update shipment status ────────────────────────────────────────────────────
export function useUpdateShipmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      shipmentId,
      status,
      orderId,
      phoneIds,
    }: {
      shipmentId: string;
      status: ShipmentStatus;
      orderId: string;
      phoneIds: string[];
    }) => {
      const batch = writeBatch(db);

      // Update the shipment status
      const shipmentRef = doc(db, 'shipments', shipmentId);
      const shipmentUpdate: Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
      };

      if (status === 'entregado') {
        shipmentUpdate.deliveredAt = serverTimestamp();
      }

      batch.update(shipmentRef, shipmentUpdate);

      // If delivered, also update the pending order and all phones
      if (status === 'entregado') {
        // Update pendingOrder status to 'delivered'
        const orderRef = doc(db, 'pendingOrders', orderId);
        batch.update(orderRef, {
          status: 'delivered',
          deliveredAt: serverTimestamp(),
        });

        // Update each phone to 'Entregado al Cliente'
        for (const phoneId of phoneIds) {
          const phoneRef = doc(db, 'phones', phoneId);
          batch.update(phoneRef, {
            estado: 'Entregado al Cliente',
            updatedAt: serverTimestamp(),
          });
        }
      }

      await batch.commit();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['phones'] });
      toast.success('Estado de envio actualizado');
    },
    onError: (error: Error) => {
      console.error('Update shipment status error:', error);
      toast.error(`Error al actualizar estado: ${error.message}`);
    },
  });
}
