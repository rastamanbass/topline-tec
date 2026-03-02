import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  limit,
  arrayUnion,
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { db, auth } from '../../../lib/firebase';
import type { ImportShipment, ShipmentCarrier } from '../../../types';

export function useImportShipments() {
  return useQuery({
    queryKey: ['import-shipments'],
    queryFn: async () => {
      const q = query(
        collection(db, 'importShipments'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ImportShipment));
    },
    staleTime: 30_000,
  });
}

export interface CreateShipmentInput {
  name: string;
  lote: string;
  phoneIds: string[];     // Phone document IDs (NOT IMEIs)
  carrier: ShipmentCarrier;
  carrierCustomName?: string;
  courierName?: string;
  trackingNumber?: string;
  estimatedArrival?: string;
  notes?: string;
}

const BATCH_SIZE = 499;

export function useCreateImportShipment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateShipmentInput) => {
      const userEmail = auth.currentUser?.email || 'unknown';
      const now = new Date();

      // Update phones in batches of 499
      const chunks: string[][] = [];
      for (let i = 0; i < input.phoneIds.length; i += BATCH_SIZE) {
        chunks.push(input.phoneIds.slice(i, i + BATCH_SIZE));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((phoneId) => {
          batch.update(doc(db, 'phones', phoneId), {
            estado: 'En Tránsito (a El Salvador)',
            updatedAt: serverTimestamp(),
            statusHistory: arrayUnion({
              newStatus: 'En Tránsito (a El Salvador)',
              date: now,
              user: userEmail,
              details: `Enviado — ${input.name}`,
            }),
          });
        });
        await batch.commit();
      }

      // Create importShipments document
      const ref = await addDoc(collection(db, 'importShipments'), {
        ...input,
        status: 'en_transito',
        createdBy: userEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return ref.id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import-shipments'] });
      qc.invalidateQueries({ queryKey: ['phones'] });
      toast.success('Envío creado. Teléfonos marcados como En Tránsito.');
    },
    onError: (err) => {
      toast.error(`Error al crear el envío: ${(err as Error).message.slice(0, 60)}`);
    },
  });
}

export function useMarkShipmentReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      shipmentId,
      receivedCount,
      reportId,
    }: {
      shipmentId: string;
      receivedCount: number;
      reportId: string;
    }) => {
      await updateDoc(doc(db, 'importShipments', shipmentId), {
        status: 'recibido',
        receivedAt: serverTimestamp(),
        receivedBy: auth.currentUser?.email || 'unknown',
        receivedCount,
        reportId,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['import-shipments'] });
    },
  });
}
