/**
 * useSuppliers — React Query hooks for the `suppliers` Firestore collection
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  orderBy,
  query,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Supplier, SupplierImportTemplate } from '../../../types';
import toast from 'react-hot-toast';

// ── Query key ─────────────────────────────────────────────────────────────────

export const SUPPLIERS_QUERY_KEY = ['suppliers'] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapSupplier(d: { id: string; data: () => Record<string, unknown> }): Supplier {
  const data = d.data();
  return {
    id: d.id,
    name: String(data.name || ''),
    code: data.code as string | undefined,
    email: data.email as string | undefined,
    phone: data.phone as string | undefined,
    address: data.address as string | undefined,
    notes: data.notes as string | undefined,
    importTemplate: data.importTemplate as SupplierImportTemplate | undefined,
    invoiceCount: Number(data.invoiceCount ?? 0),
    totalPhonesPurchased: Number(data.totalPhonesPurchased ?? 0),
    autoSeeded: data.autoSeeded as boolean | undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

// ── useSuppliers ──────────────────────────────────────────────────────────────

/**
 * List all suppliers, ordered by name ascending.
 */
export function useSuppliers() {
  return useQuery({
    queryKey: SUPPLIERS_QUERY_KEY,
    queryFn: async (): Promise<Supplier[]> => {
      const q = query(collection(db, 'suppliers'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(mapSupplier);
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// ── useCreateSupplier ─────────────────────────────────────────────────────────

export interface CreateSupplierInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

/**
 * Mutation to create a new supplier document.
 * Returns the new document ID on success.
 */
export function useCreateSupplier() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSupplierInput): Promise<string> => {
      const docRef = await addDoc(collection(db, 'suppliers'), {
        name: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        address: input.address ?? null,
        notes: input.notes ?? null,
        invoiceCount: 0,
        totalPhonesPurchased: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return docRef.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY });
      toast.success('Proveedor creado');
    },
    onError: (err) => {
      console.error('useCreateSupplier error:', err);
      toast.error('Error al crear proveedor');
    },
  });
}

// ── useUpdateSupplierTemplate ─────────────────────────────────────────────────

/**
 * Mutation to save or update the import template for a supplier.
 */
export function useUpdateSupplierTemplate(supplierId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (template: SupplierImportTemplate): Promise<void> => {
      await updateDoc(doc(db, 'suppliers', supplierId), {
        importTemplate: template,
        updatedAt: serverTimestamp(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY });
    },
    onError: (err) => {
      console.error('useUpdateSupplierTemplate error:', err);
    },
  });
}
