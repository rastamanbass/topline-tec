/**
 * useSupplierStats — Aggregation-based stats for suppliers.
 * Uses getCountFromServer / getAggregateFromServer for O(0 document downloads).
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
// isInternalCode no longer needed — supplierCode field is always an uppercase code
import { useSuppliers, SUPPLIERS_QUERY_KEY } from '../../supplier-invoices/hooks/useSuppliers';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SupplierWithStats {
  id: string;
  name: string;
  code?: string;
  inStock: number;
  totalPurchased: number;
  totalSold: number;
  totalRevenue: number;
  lastActivity: Date | null;
  autoSeeded?: boolean;
}

// ── Status groups ─────────────────────────────────────────────────────────────

const STOCK_STATES = [
  'En Stock (Disponible para Venta)',
  'Apartado',
  'En Taller (Recibido)',
  'Recibido de Taller (OK)',
  'En Bodega (USA)',
  'En Tránsito (a El Salvador)',
];

const SOLD_STATES = [
  'Vendido',
  'Pagado',
  'Entregado al Cliente',
  'Vendido (Pendiente de Entrega)',
];

// ── Stats fetcher for a single supplier code ──────────────────────────────────
// Eduardo enters codes with inconsistent casing (e.g. "xt" and "XT" are the same supplier).
// We query both uppercase and lowercase variants and sum the results.
// Firestore is case-sensitive and doesn't allow two `in` clauses, so we run
// separate aggregation queries per variant and accumulate.

function toActivityDate(val: unknown): Date | null {
  if (!val) return null;
  if (typeof val === 'string') return new Date(val);
  if (typeof (val as { toDate?: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate();
  }
  return null;
}

async function fetchStatsForCode(code: string) {
  const phonesRef = collection(db, 'phones');
  const upperCode = code.toUpperCase();

  // supplierCode is always stored uppercase, so a single query per stat is enough
  const [countSnap, stockSnap, soldSnap, revenueSnap, lastSnap] = await Promise.all([
    getCountFromServer(query(phonesRef, where('supplierCode', '==', upperCode))).catch(() => null),
    getCountFromServer(
      query(phonesRef, where('supplierCode', '==', upperCode), where('estado', 'in', STOCK_STATES))
    ).catch(() => null),
    getCountFromServer(
      query(phonesRef, where('supplierCode', '==', upperCode), where('estado', 'in', SOLD_STATES))
    ).catch(() => null),
    getAggregateFromServer(
      query(phonesRef, where('supplierCode', '==', upperCode), where('estado', 'in', SOLD_STATES)),
      { totalRevenue: sum('precioVenta') }
    ).catch(() => null),
    getDocs(
      query(phonesRef, where('supplierCode', '==', upperCode), orderBy('fechaIngreso', 'desc'), limit(1))
    ).catch(() => null),
  ]);

  const totalPurchased = countSnap?.data().count ?? 0;
  const inStock = stockSnap?.data().count ?? 0;
  const totalSold = soldSnap?.data().count ?? 0;
  const totalRevenue = revenueSnap?.data().totalRevenue ?? 0;
  let lastActivity: Date | null = null;
  if (lastSnap && !lastSnap.empty) {
    lastActivity = toActivityDate(lastSnap.docs[0].data().fechaIngreso);
  }

  return { totalPurchased, inStock, totalSold, totalRevenue, lastActivity };
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useSupplierStats() {
  const { data: suppliers = [], isLoading: suppliersLoading } = useSuppliers();

  const statsQuery = useQuery({
    queryKey: ['supplier-stats', suppliers.map((s) => s.id).join(',')],
    queryFn: async (): Promise<SupplierWithStats[]> => {
      // Only fetch stats for suppliers that have a code
      const suppliersWithCode = suppliers.filter((s) => s.code);
      if (suppliersWithCode.length === 0) return [];

      const results = await Promise.all(
        suppliersWithCode.map(async (supplier) => {
          const stats = await fetchStatsForCode(supplier.code!);
          return {
            id: supplier.id,
            name: supplier.name,
            code: supplier.code,
            autoSeeded: supplier.autoSeeded,
            ...stats,
          };
        })
      );

      // Sort by totalRevenue descending
      results.sort((a, b) => b.totalRevenue - a.totalRevenue);
      return results;
    },
    enabled: suppliers.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    suppliers: statsQuery.data ?? [],
    isLoading: suppliersLoading || statsQuery.isLoading,
    isError: statsQuery.isError,
    refetch: statsQuery.refetch,
  };
}

// ── Auto-seed mutation ────────────────────────────────────────────────────────

export function useAutoSeedSuppliers() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<number> => {
      // 1. Fetch all phones (one-time)
      const phonesSnap = await getDocs(collection(db, 'phones'));

      // 2. Extract unique supplierCode values (already uppercase, already validated at write time)
      const codeSet = new Set<string>();
      phonesSnap.docs.forEach((d) => {
        const supplierCode = (d.data().supplierCode as string || '').trim();
        if (supplierCode && supplierCode !== 'null') {
          codeSet.add(supplierCode.toUpperCase());
        }
      });

      // 3. Check which codes already have supplier docs
      const existingSnap = await getDocs(collection(db, 'suppliers'));
      const existingCodes = new Set<string>();
      existingSnap.docs.forEach((d) => {
        const code = (d.data().code as string || '').toUpperCase();
        if (code) existingCodes.add(code);
      });

      // 4. Create missing supplier documents
      let created = 0;
      const promises: Promise<unknown>[] = [];

      for (const code of codeSet) {
        if (existingCodes.has(code)) continue;
        promises.push(
          addDoc(collection(db, 'suppliers'), {
            name: code,
            code: code,
            invoiceCount: 0,
            totalPhonesPurchased: 0,
            autoSeeded: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          })
        );
        created++;
      }

      await Promise.all(promises);
      return created;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['supplier-stats'] });
      if (count > 0) {
        toast.success(`${count} proveedores importados del inventario`);
      } else {
        toast.success('Todos los proveedores ya estaban registrados');
      }
    },
    onError: (err) => {
      toast.error('Error al importar proveedores');
      throw err;
    },
  });
}
