import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Search, ChevronDown, ChevronUp, X, FileText } from 'lucide-react';
import { useSalesHistory, type SaleRecord } from './hooks/useSalesHistory';
import { useRecentInvoicesMap } from '../invoices/hooks/useInvoicesByClient';
import type { PurchaseItem } from '../../types';
import InvoiceModal from '../invoices/components/InvoiceModal';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('es-SV', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);

export default function SalesHistoryPage() {
  const { data: sales = [], isLoading } = useSalesHistory();
  const { data: invoicesData } = useRecentInvoicesMap();
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewingInvoiceId, setViewingInvoiceId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!search.trim()) return sales;
    const q = search.toLowerCase();
    return sales.filter(
      (s) =>
        s.clientName.toLowerCase().includes(q) ||
        s.paymentMethod?.toLowerCase().includes(q) ||
        s.items?.some(
          (item: PurchaseItem) =>
            item.description?.toLowerCase().includes(q) || item.imei?.toLowerCase().includes(q)
        )
    );
  }, [sales, search]);

  const totalRevenue = filtered.reduce((s, sale) => s + (sale.totalAmount || 0), 0);
  const totalDebtIncurred = filtered.reduce((s, sale) => s + (sale.debtIncurred || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16">
            <Link to="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <ShoppingBag className="w-6 h-6 text-blue-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Historial de Ventas</h1>
                <p className="text-xs text-gray-500">{filtered.length} transacciones</p>
              </div>
            </div>

            {/* Search */}
            <div className="ml-auto relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente, IMEI..."
                className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Summary Bar */}
        {!isLoading && filtered.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-xs text-blue-700 font-medium mb-1">Total Vendido</p>
              <p className="text-2xl font-bold text-blue-900">{fmt(totalRevenue)}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 font-medium mb-1">Transacciones</p>
              <p className="text-2xl font-bold text-gray-900">{filtered.length}</p>
            </div>
            {totalDebtIncurred > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <p className="text-xs text-red-700 font-medium mb-1">Deuda Generada</p>
                <p className="text-2xl font-bold text-red-700">{fmt(totalDebtIncurred)}</p>
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <LoadingSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <ShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>{search ? 'No se encontraron ventas' : 'No hay ventas registradas'}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase font-medium border-b border-gray-100">
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Cliente</th>
                  <th className="text-left px-4 py-3">Metodo Pago</th>
                  <th className="text-right px-4 py-3">Descuento</th>
                  <th className="text-right px-4 py-3">Deuda</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-center px-4 py-3">Items</th>
                  <th className="text-center px-4 py-3">Factura</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((sale) => {
                  const invoiceId = invoicesData?.purchaseToInvoice.get(sale.id);
                  return (
                    <SaleRow
                      key={sale.id}
                      sale={sale}
                      invoiceId={invoiceId}
                      isExpanded={expandedId === sale.id}
                      onToggle={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                      onViewInvoice={setViewingInvoiceId}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Invoice Modal */}
      {viewingInvoiceId && (
        <InvoiceModal invoiceId={viewingInvoiceId} onClose={() => setViewingInvoiceId(null)} />
      )}
    </div>
  );
}

function SaleRow({
  sale,
  invoiceId,
  isExpanded,
  onToggle,
  onViewInvoice,
}: {
  sale: SaleRecord;
  invoiceId?: string;
  isExpanded: boolean;
  onToggle: () => void;
  onViewInvoice: (id: string) => void;
}) {
  const itemCount = sale.items?.length || 0;

  return (
    <>
      <tr
        className={`hover:bg-gray-50 cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50/30' : ''}`}
        onClick={onToggle}
      >
        <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
          {fmtDate(sale.purchaseDate)}
        </td>
        <td className="px-4 py-3 font-medium text-gray-900">{sale.clientName}</td>
        <td className="px-4 py-3">
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {sale.paymentMethod || 'N/A'}
          </span>
        </td>
        <td className="px-4 py-3 text-right text-orange-600 text-xs">
          {sale.discountAmount ? fmt(sale.discountAmount) : '—'}
        </td>
        <td className="px-4 py-3 text-right text-red-600 text-xs">
          {sale.debtIncurred ? fmt(sale.debtIncurred) : '—'}
        </td>
        <td className="px-4 py-3 text-right font-bold text-gray-900">{fmt(sale.totalAmount)}</td>
        <td className="px-4 py-3 text-center">
          <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {itemCount}
          </span>
        </td>
        <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
          {invoiceId ? (
            <button
              onClick={() => onViewInvoice(invoiceId)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium mx-auto"
            >
              <FileText className="w-3.5 h-3.5" />
              Ver
            </button>
          ) : (
            <span className="text-xs text-gray-300">—</span>
          )}
        </td>
        <td className="px-4 py-3 text-gray-400">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={9} className="px-4 pb-4 bg-blue-50/20">
            <div className="rounded-xl border border-blue-100 bg-white overflow-hidden mt-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 uppercase font-medium">
                    <th className="text-left px-3 py-2">Descripcion</th>
                    <th className="text-left px-3 py-2">IMEI</th>
                    <th className="text-right px-3 py-2">Precio</th>
                    <th className="text-right px-3 py-2">Cant.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(sale.items || []).map((item: PurchaseItem, i: number) => (
                    <tr key={i}>
                      <td className="px-3 py-2 font-medium text-gray-800">{item.description}</td>
                      <td className="px-3 py-2 font-mono text-gray-500">{item.imei || '—'}</td>
                      <td className="px-3 py-2 text-right text-gray-900">{fmt(item.price)}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{item.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sale.notes && (
                <div className="px-3 py-2 border-t border-gray-100 text-gray-500 italic">
                  Nota: {sale.notes}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="h-12 bg-gray-200 rounded-lg" />
      ))}
    </div>
  );
}
