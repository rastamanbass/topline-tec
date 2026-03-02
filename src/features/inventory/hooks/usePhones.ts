import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  arrayUnion,
  serverTimestamp,
  type Timestamp,
  type QueryConstraint,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import type { Phone, PhoneStatus } from '../../../types';
import toast from 'react-hot-toast';
import { saveDeviceDefinition } from '../services/deviceService';
import { buildHistoryEntry } from '../../../lib/historyUtils';
import { normalizeDisplayBrand, normalizeStorage, normalizeIPhoneModel } from '../../../lib/phoneUtils';

// Filters interface
export interface PhoneFilters {
  lot?: string | null;
  status?: PhoneStatus | null;
  searchQuery?: string;
}

const PAGE_SIZE = 50;

// Convert Firestore Timestamp | Date | string to Date (handles legacy string dates from prod)
const convertTimestamp = (timestamp: Timestamp | Date | string | unknown): Date => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp === 'string') return new Date(timestamp);
  if (typeof (timestamp as Timestamp).toDate === 'function')
    return (timestamp as Timestamp).toDate();
  return new Date();
};

const mapPhone = (d: { id: string; data: () => Record<string, unknown> }): Phone => {
  const data = d.data();
  return {
    id: d.id,
    ...data,
    fechaIngreso: data.fechaIngreso ? convertTimestamp(data.fechaIngreso) : new Date(),
    fechaVenta: data.fechaVenta ? convertTimestamp(data.fechaVenta) : undefined,
    updatedAt: data.updatedAt ? convertTimestamp(data.updatedAt) : undefined,
  } as Phone;
};

const applyClientSearch = (phones: Phone[], searchQuery?: string): Phone[] => {
  if (!searchQuery) return phones;
  const q = searchQuery.toLowerCase();
  return phones.filter(
    (p) =>
      p.imei.toLowerCase().includes(q) ||
      p.modelo.toLowerCase().includes(q) ||
      p.marca.toLowerCase().includes(q) ||
      normalizeDisplayBrand(p.marca).toLowerCase().includes(q) ||
      (p.supplierCode?.toLowerCase().includes(q) ?? false)
  );
};

// ── PAGINATED (for Inventory page) ────────────────────────────────────────────
// Uses useInfiniteQuery with cursor pagination. Loads 50 phones at a time.
// Composite indexes already exist for (lote, fechaIngreso) and (estado, fechaIngreso).
export function usePhonesPaginated(filters: PhoneFilters = {}) {
  return useInfiniteQuery({
    queryKey: ['phones-paginated', filters],
    queryFn: async ({ pageParam }) => {
      const constraints: QueryConstraint[] = [
        orderBy('fechaIngreso', 'desc'),
        limit(PAGE_SIZE),
      ];
      if (filters.lot) constraints.unshift(where('lote', '==', filters.lot));
      if (filters.status) constraints.unshift(where('estado', '==', filters.status));
      if (pageParam) constraints.push(startAfter(pageParam));

      const q = query(collection(db, 'phones'), ...constraints);
      const snapshot = await getDocs(q);

      const phones = applyClientSearch(
        snapshot.docs.map(mapPhone),
        filters.searchQuery
      );

      return {
        phones,
        lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
        hasMore: snapshot.docs.length === PAGE_SIZE,
      };
    },
    initialPageParam: null as DocumentSnapshot | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.lastDoc : undefined),
  });
}

// ── BASE HOOK (for Dashboard, Finance, Insights, Workshop search) ──────────────
// Safety limit of 500 — prevents catastrophic reads. For analytics that need
// aggregate data across all time, move those to Cloud Functions when needed.
export function usePhones(filters: PhoneFilters = {}) {
  return useQuery({
    queryKey: ['phones', filters],
    queryFn: async () => {
      const constraints: QueryConstraint[] = [
        orderBy('fechaIngreso', 'desc'),
        limit(500),
      ];
      if (filters.lot) constraints.unshift(where('lote', '==', filters.lot));
      if (filters.status) constraints.unshift(where('estado', '==', filters.status));

      const q = query(collection(db, 'phones'), ...constraints);
      const snapshot = await getDocs(q);

      return applyClientSearch(snapshot.docs.map(mapPhone), filters.searchQuery);
    },
  });
}

// Create new phone
export function useCreatePhone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (phone: Omit<Phone, 'id' | 'fechaIngreso' | 'statusHistory'>) => {
      // Save TAC definition (fire and forget)
      if (phone.imei && phone.imei.length >= 8) {
        const tac = phone.imei.substring(0, 8);
        saveDeviceDefinition(tac, phone.marca, phone.modelo);
      }
      // Update price catalog (fire and forget)
      if (phone.precioVenta > 0 && phone.modelo) {
        const displayBrand = normalizeDisplayBrand(phone.marca);
        const storageVal = normalizeStorage(phone.storage);
        const normalizedModel = displayBrand === 'Apple'
          ? normalizeIPhoneModel(phone.modelo || '')
          : (phone.modelo || 'Unknown');
        const safeId = `${displayBrand}-${normalizedModel}-${storageVal}`
          .replace(/\//g, '-')
          .replace(/\s+/g, '-')
          .toLowerCase();
        setDoc(
          doc(db, 'price_catalog', safeId),
          {
            brand: displayBrand,
            model: phone.modelo,
            storage: storageVal,
            averagePrice: phone.precioVenta,
            lastUpdated: new Date(),
            source: 'auto',
          },
          { merge: true }
        ).catch((err) => console.error('Failed to learn price', err));
      }

      const docRef = await addDoc(collection(db, 'phones'), {
        ...phone,
        fechaIngreso: serverTimestamp(),
        createdBy: auth.currentUser?.uid,
        updatedAt: serverTimestamp(),
        statusHistory: [
          {
            newStatus: phone.estado,
            date: new Date().toISOString(),
            user: auth.currentUser?.email || 'unknown',
            details: 'Teléfono creado',
          },
        ],
      });
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phones'] });
      queryClient.invalidateQueries({ queryKey: ['phones-paginated'] });
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
    mutationFn: async ({
      id,
      data,
      previousEstado,
    }: {
      id: string;
      data: Partial<Phone>;
      previousEstado?: PhoneStatus;
    }) => {
      const phoneRef = doc(db, 'phones', id);
      const updatePayload: Record<string, unknown> = {
        ...data,
        updatedAt: serverTimestamp(),
      };

      // If estado changed, append to statusHistory
      if (data.estado && previousEstado && data.estado !== previousEstado) {
        updatePayload.statusHistory = arrayUnion(
          buildHistoryEntry(data.estado, 'Editado manualmente')
        );
      }

      await updateDoc(phoneRef, updatePayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phones'] });
      queryClient.invalidateQueries({ queryKey: ['phones-paginated'] });
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
      queryClient.invalidateQueries({ queryKey: ['phones-paginated'] });
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
      const statusChange = {
        newStatus,
        date: new Date().toISOString(),
        user: auth.currentUser?.email || 'unknown',
        details: details || '',
      };
      // arrayUnion appends atomically without reading the full document first
      await updateDoc(phoneRef, {
        estado: newStatus,
        updatedAt: serverTimestamp(),
        statusHistory: arrayUnion(statusChange),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phones'] });
      queryClient.invalidateQueries({ queryKey: ['phones-paginated'] });
      toast.success('Estado actualizado exitosamente');
    },
    onError: (error: Error) => {
      console.error('Change status error:', error);
      toast.error(`Error al cambiar estado: ${error.message}`);
    },
  });
}
