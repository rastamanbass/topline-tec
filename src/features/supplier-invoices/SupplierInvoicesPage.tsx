/**
 * SupplierInvoicesPage — /supplier-invoices
 * Lists all imported supplier invoices and provides an import button.
 * Accessible to admin and gerente roles only.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileSpreadsheet,
  Plus,
  ArrowUpRight,
  Package,
  Building2,
  FileText,
} from 'lucide-react';
import { useSupplierInvoices } from './hooks/useSupplierInvoices';
import { useSuppliers } from './hooks/useSuppliers';
import ImportInvoiceModal from './components/ImportInvoiceModal';
import type { SupplierInvoice } from '../../types';

// ── Status badge config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  SupplierInvoice['status'],
  { label: string; className: string }
> = {
  imported: {
    label: 'Importado',
    className: 'bg-gray-100 text-gray-600',
  },
  pending_arrival: {
    label: 'En Tránsito',
    className: 'bg-blue-100 text-blue-700',
  },
  received: {
    label: 'Recibido',
    className: 'bg-emerald-100 text-emerald-700',
  },
  archived: {
    label: 'Archivado',
    className: 'bg-gray-50 text-gray-400',
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(raw: unknown): string {
  if (!raw) return '—';
  try {
    // Firestore Timestamp
    if (typeof (raw as { toDate?: () => Date }).toDate === 'function') {
      return (raw as { toDate: () => Date }).toDate().toLocaleDateString('es-SV');
    }
    if (typeof raw === 'string') return new Date(raw).toLocaleDateString('es-SV');
    if (raw instanceof Date) return raw.toLocaleDateString('es-SV');
  } catch {
    // ignore
  }
  return '—';
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SupplierInvoicesPage() {
  const [showModal, setShowModal] = useState(false);

  const { data: invoices = [], isLoading: loadingInvoices } = useSupplierInvoices();
  const { data: suppliers = [], isLoading: loadingSuppliers } = useSuppliers();

  const loading = loadingInvoices || loadingSuppliers;

  const totalPhones = invoices.reduce((sum, inv) => sum + inv.totalPhones, 0);
  const totalAmount = invoices.reduce(
    (sum, inv) => sum + (inv.totalAmount ?? 0),
    0
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Facturas de Proveedores</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Importa facturas Excel o PDF para agregar teléfonos al inventario
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors text-sm shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Importar Factura
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{invoices.length}</p>
                <p className="text-xs text-gray-500">Total facturas</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <Package className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalPhones.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Teléfonos importados</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{suppliers.length}</p>
                <p className="text-xs text-gray-500">Proveedores registrados</p>
              </div>
            </div>
          </div>
        </div>

        {/* Invoices table */}
        {loading ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : invoices.length === 0 ? (
          /* Empty state */
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-16 flex flex-col items-center gap-4">
            <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center">
              <FileSpreadsheet className="w-10 h-10 text-indigo-400" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-800">Sin facturas importadas</h3>
              <p className="text-gray-500 text-sm mt-1 max-w-xs">
                Importa tu primera factura de proveedor para agregar teléfonos al inventario
                automáticamente.
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Importar primera factura
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-xs text-gray-500 uppercase tracking-wider">
                    <th className="px-5 py-3 text-left font-medium">#</th>
                    <th className="px-5 py-3 text-left font-medium">Proveedor</th>
                    <th className="px-5 py-3 text-left font-medium">Factura</th>
                    <th className="px-5 py-3 text-left font-medium">Fecha</th>
                    <th className="px-5 py-3 text-right font-medium">Teléfonos</th>
                    <th className="px-5 py-3 text-right font-medium">Total USD</th>
                    <th className="px-5 py-3 text-left font-medium">Lote</th>
                    <th className="px-5 py-3 text-left font-medium">Estado</th>
                    <th className="px-5 py-3 text-center font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invoices.map((inv, idx) => {
                    const statusCfg = STATUS_CONFIG[inv.status] || STATUS_CONFIG.imported;
                    return (
                      <tr
                        key={inv.id}
                        className="hover:bg-gray-50/60 transition-colors"
                      >
                        <td className="px-5 py-3.5 text-gray-400 text-xs">{idx + 1}</td>
                        <td className="px-5 py-3.5">
                          <span className="font-medium text-gray-800">{inv.supplierName}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            {inv.fileType === 'excel' ? (
                              <FileSpreadsheet className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                            )}
                            <span className="text-gray-700 font-mono text-xs">{inv.invoiceNumber}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs">
                          {formatDate(inv.createdAt)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-gray-800">
                          {inv.totalPhones}
                        </td>
                        <td className="px-5 py-3.5 text-right text-gray-600">
                          {inv.totalAmount != null
                            ? `$${inv.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`
                            : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-gray-600 max-w-[140px] truncate">
                          {inv.importedLote}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2 py-1 rounded-full text-[11px] font-medium ${statusCfg.className}`}
                          >
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <Link
                            to={`/inventory?lot=${encodeURIComponent(inv.importedLote)}`}
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-medium transition-colors"
                          >
                            Ver Lote
                            <ArrowUpRight className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table footer */}
            {invoices.length > 0 && (
              <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>
                  {invoices.length} factura{invoices.length !== 1 ? 's' : ''}
                </span>
                {totalAmount > 0 && (
                  <span>
                    Total invertido:{' '}
                    <span className="font-semibold text-gray-700">
                      $
                      {totalAmount.toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                      })}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Suppliers section */}
        {suppliers.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Proveedores</h2>
              <span className="text-xs text-gray-400">{suppliers.length} registrados</span>
            </div>
            <div className="divide-y divide-gray-50">
              {suppliers.map((s) => (
                <div
                  key={s.id}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-gray-50/60 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-800">{s.name}</p>
                    {s.email && <p className="text-xs text-gray-400">{s.email}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-700">
                      {s.totalPhonesPurchased.toLocaleString()} equipos
                    </p>
                    <p className="text-xs text-gray-400">
                      {s.invoiceCount} factura{s.invoiceCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && <ImportInvoiceModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
