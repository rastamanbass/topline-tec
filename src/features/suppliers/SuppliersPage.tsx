/**
 * SuppliersPage — Vista de gestión de proveedores con stats reales del inventario.
 * Stats via Firestore aggregations (0 documentos descargados).
 * Auto-seed silencioso al primer uso.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Plus,
  Loader2,
  Smartphone,
  DollarSign,
  Package,
  ArrowUpRight,
} from 'lucide-react';
import { useSupplierStats, useAutoSeedSuppliers } from './hooks/useSupplierStats';
import { useSuppliers } from '../supplier-invoices/hooks/useSuppliers';
import AddSupplierModal from './components/AddSupplierModal';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);

const fmtDate = (d: Date | null) => {
  if (!d || isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('es-SV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
};

function daysSince(d: Date | null): number | null {
  if (!d || isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function ActivityBadge({ date }: { date: Date | null }) {
  const days = daysSince(date);
  const label = fmtDate(date);
  if (!label) return <span className="text-gray-300 text-sm">—</span>;

  let cls = 'bg-gray-100 text-gray-500';
  if (days !== null && days < 30) cls = 'bg-emerald-100 text-emerald-700';
  else if (days !== null && days < 90) cls = 'bg-amber-100 text-amber-700';

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-6 py-4">
        <div className="h-6 w-12 bg-gray-100 rounded-lg" />
      </td>
      <td className="px-6 py-4">
        <div className="h-4 w-28 bg-gray-100 rounded" />
      </td>
      <td className="px-6 py-4 text-center">
        <div className="h-5 w-8 bg-gray-100 rounded-full mx-auto" />
      </td>
      <td className="px-6 py-4 text-center hidden sm:table-cell">
        <div className="h-4 w-10 bg-gray-100 rounded mx-auto" />
      </td>
      <td className="px-6 py-4 text-center hidden sm:table-cell">
        <div className="h-4 w-10 bg-gray-100 rounded mx-auto" />
      </td>
      <td className="px-6 py-4 text-right">
        <div className="h-5 w-16 bg-gray-100 rounded ml-auto" />
      </td>
      <td className="px-6 py-4 hidden md:table-cell">
        <div className="h-5 w-24 bg-gray-100 rounded" />
      </td>
      <td className="px-6 py-4" />
    </tr>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const navigate = useNavigate();
  const { data: rawSuppliers = [], isLoading: suppliersLoading } = useSuppliers();
  const { suppliers, isLoading } = useSupplierStats();
  const autoSeed = useAutoSeedSuppliers();
  const [showAddModal, setShowAddModal] = useState(false);

  // Silently seed any missing suppliers from phones inventory on every visit.
  // autoSeed is idempotent — skips codes that already have a supplier doc.
  useEffect(() => {
    if (!suppliersLoading && !autoSeed.isPending && !autoSeed.isSuccess) {
      autoSeed.mutate();
    }
  }, [suppliersLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Summary totals
  const totalPurchased = suppliers.reduce((s, sup) => s + sup.totalPurchased, 0);
  const totalRevenue = suppliers.reduce((s, sup) => s + sup.totalRevenue, 0);
  const totalInStock = suppliers.reduce((s, sup) => s + sup.inStock, 0);
  const topSupplier = suppliers[0] ?? null;

  const showSkeleton = isLoading || autoSeed.isPending;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl text-white shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">Proveedores</h1>
                {suppliers.length > 0 && (
                  <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {suppliers.length}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                Fuentes de compra y sus estadísticas reales del inventario
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 active:bg-indigo-800 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nuevo proveedor
          </button>
        </div>

        {/* ── Summary cards ──────────────────────────────────────────── */}
        {(showSkeleton || suppliers.length > 0) && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Proveedores */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Proveedores
              </p>
              {showSkeleton ? (
                <div className="h-8 w-12 bg-gray-100 rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-bold text-gray-900">{suppliers.length}</p>
              )}
            </div>

            {/* En stock */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                En stock
              </p>
              {showSkeleton ? (
                <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
              ) : (
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-gray-900">{totalInStock.toLocaleString()}</p>
                  <Smartphone className="w-4 h-4 text-gray-300 mb-1.5" />
                </div>
              )}
            </div>

            {/* Total comprados */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Total comprados
              </p>
              {showSkeleton ? (
                <div className="h-8 w-16 bg-gray-100 rounded animate-pulse" />
              ) : (
                <div className="flex items-end gap-2">
                  <p className="text-3xl font-bold text-gray-900">{totalPurchased.toLocaleString()}</p>
                  <Package className="w-4 h-4 text-gray-300 mb-1.5" />
                </div>
              )}
            </div>

            {/* Revenue */}
            <div className="bg-indigo-600 rounded-2xl shadow-sm p-5">
              <p className="text-xs font-semibold text-indigo-200 uppercase tracking-wider mb-3">
                Revenue total
              </p>
              {showSkeleton ? (
                <div className="h-8 w-24 bg-indigo-500 rounded animate-pulse" />
              ) : (
                <div>
                  <p className="text-3xl font-bold text-white">{fmt(totalRevenue)}</p>
                  {topSupplier && (
                    <p className="text-xs text-indigo-200 mt-1 truncate">
                      Top: {topSupplier.name} · {fmt(topSupplier.totalRevenue)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Table ──────────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Empty state */}
          {!showSkeleton && suppliers.length === 0 && (
            <div className="py-20 text-center px-6">
              <div className="inline-flex p-4 bg-gray-50 rounded-2xl mb-5">
                <Building2 className="w-10 h-10 text-gray-300" />
              </div>
              <h3 className="text-base font-semibold text-gray-800 mb-2">
                Sin proveedores registrados
              </h3>
              <p className="text-sm text-gray-400 max-w-xs mx-auto">
                Agregá tu primer proveedor para ver sus estadísticas de compra aquí.
              </p>
            </div>
          )}

          {/* Table header + rows */}
          {(showSkeleton || suppliers.length > 0) && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Código
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Proveedor
                    </th>
                    <th className="px-6 py-3.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      En stock
                    </th>
                    <th className="px-6 py-3.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                      Comprados
                    </th>
                    <th className="px-6 py-3.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">
                      Vendidos
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">
                      Último envío
                    </th>
                    <th className="px-6 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {showSkeleton
                    ? [...Array(6)].map((_, i) => <SkeletonRow key={i} />)
                    : suppliers.map((sup) => {
                        const revenueShare =
                          totalRevenue > 0
                            ? Math.round((sup.totalRevenue / totalRevenue) * 100)
                            : 0;

                        return (
                          <tr
                            key={sup.id}
                            className="group hover:bg-gray-50/80 transition-colors cursor-pointer"
                            onClick={() =>
                              navigate(
                                `/inventory?marca=${encodeURIComponent(sup.code || sup.name)}`
                              )
                            }
                          >
                            {/* Código */}
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-mono text-xs font-bold tracking-wide">
                                {sup.code || '—'}
                              </span>
                            </td>

                            {/* Nombre */}
                            <td className="px-6 py-4">
                              <p className="font-semibold text-gray-900">{sup.name}</p>
                              {revenueShare > 0 && (
                                <div className="flex items-center gap-1.5 mt-1">
                                  <div className="h-1 rounded-full bg-indigo-100 w-20 overflow-hidden">
                                    <div
                                      className="h-1 rounded-full bg-indigo-500"
                                      style={{ width: `${revenueShare}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-400">{revenueShare}%</span>
                                </div>
                              )}
                            </td>

                            {/* En stock */}
                            <td className="px-6 py-4 text-center">
                              <span
                                className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold ${
                                  sup.inStock > 0
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-gray-100 text-gray-400'
                                }`}
                              >
                                {sup.inStock}
                              </span>
                            </td>

                            {/* Comprados */}
                            <td className="px-6 py-4 text-center text-gray-600 font-medium hidden sm:table-cell">
                              {sup.totalPurchased.toLocaleString()}
                            </td>

                            {/* Vendidos */}
                            <td className="px-6 py-4 text-center text-gray-600 font-medium hidden sm:table-cell">
                              {sup.totalSold.toLocaleString()}
                            </td>

                            {/* Revenue */}
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="font-bold text-gray-900">
                                  {fmt(sup.totalRevenue).replace('$', '')}
                                </span>
                              </div>
                            </td>

                            {/* Último envío */}
                            <td className="px-6 py-4 hidden md:table-cell">
                              <ActivityBadge date={sup.lastActivity} />
                            </td>

                            {/* Acción */}
                            <td className="px-6 py-4 text-right">
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                Ver
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                </tbody>

                {/* Footer totals */}
                {!showSkeleton && suppliers.length > 1 && (
                  <tfoot>
                    <tr className="border-t-2 border-gray-100 bg-gray-50/60">
                      <td colSpan={2} className="px-6 py-3.5">
                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          Total
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center">
                        <span className="text-xs font-bold text-gray-700">
                          {totalInStock.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center hidden sm:table-cell">
                        <span className="text-xs font-bold text-gray-700">
                          {totalPurchased.toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-center hidden sm:table-cell">
                        <span className="text-xs font-bold text-gray-700">
                          {suppliers.reduce((s, sup) => s + sup.totalSold, 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className="text-sm font-bold text-indigo-700">{fmt(totalRevenue)}</span>
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </div>

        {/* Loading indicator for aggregations (non-blocking) */}
        {!suppliersLoading && rawSuppliers.length > 0 && isLoading && (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-gray-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Calculando estadísticas...
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && <AddSupplierModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}
