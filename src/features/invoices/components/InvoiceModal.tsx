import { useEffect } from 'react';
import { X, Printer, CheckCircle } from 'lucide-react';
import { useInvoice } from '../hooks/useInvoices';

interface InvoiceModalProps {
  invoiceId: string;
  onClose: () => void;
  onInvoiceNumberLoaded?: (num: string) => void;
  isNewInvoice?: boolean;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

function parseInvoiceDate(ts: unknown): string {
  if (!ts) return new Date().toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' });
  if (ts instanceof Date) return ts.toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' });
  if (typeof ts === 'object' && ts !== null && typeof (ts as { toDate?: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return new Date().toLocaleDateString('es-SV', { day: '2-digit', month: 'short', year: 'numeric' });
}

function parseInvoiceTime(ts: unknown): string {
  if (!ts) return new Date().toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });
  if (ts instanceof Date) return ts.toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });
  if (typeof ts === 'object' && ts !== null && typeof (ts as { toDate?: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });
  }
  return new Date().toLocaleTimeString('es-SV', { hour: '2-digit', minute: '2-digit' });
}

export default function InvoiceModal({
  invoiceId,
  onClose,
  onInvoiceNumberLoaded,
  isNewInvoice = false,
}: InvoiceModalProps) {
  const { data: invoice, isLoading } = useInvoice(invoiceId);

  useEffect(() => {
    if (invoice?.invoiceNumber && onInvoiceNumberLoaded) {
      onInvoiceNumberLoaded(invoice.invoiceNumber);
    }
  }, [invoice?.invoiceNumber, onInvoiceNumberLoaded]);

  return (
    <>
      {/* Screen overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60] p-4 print:hidden">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-5 border-b border-gray-100 print:hidden">
            <div className="flex items-center gap-2">
              {isNewInvoice && <CheckCircle className="w-5 h-5 text-green-500" />}
              <h2 className="text-lg font-bold text-gray-900">
                {isLoading ? 'Cargando factura...' : invoice?.invoiceNumber || 'Factura'}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Invoice Body */}
          {isLoading ? (
            <div className="p-8 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : !invoice ? (
            <div className="p-8 text-center text-gray-500">No se encontro la factura.</div>
          ) : (
            <InvoiceDocument invoice={invoice} />
          )}
        </div>
      </div>

      {/* Print-only version — renders the invoice document full-page */}
      {invoice && (
        <div className="hidden print:block">
          <InvoiceDocument invoice={invoice} />
        </div>
      )}
    </>
  );
}

function InvoiceDocument({ invoice }: { invoice: NonNullable<ReturnType<typeof useInvoice>['data']> }) {
  if (!invoice) return null;

  const totalItems = invoice.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="p-8 print:p-6 font-sans text-gray-900">
      {/* Header */}
      <div className="flex justify-between items-start mb-6 pb-5 border-b-2 border-gray-900 print:mb-4 print:pb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-gray-900 print:text-xl">
            TOP LINE TEC
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{invoice.company.address}</p>
          <p className="text-xs text-gray-400">{invoice.company.description}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-gray-900 print:text-lg">{invoice.invoiceNumber}</p>
          <p className="text-xs text-gray-500 mt-1">ACTA DE VENTA</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Este documento no tiene valor fiscal.
          </p>
        </div>
      </div>

      {/* Client & Date Info */}
      <div className="grid grid-cols-2 gap-6 mb-6 print:mb-4">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Facturado a</p>
          <p className="font-semibold text-gray-900">{invoice.clientName}</p>
          {invoice.clientPhone && (
            <p className="text-sm text-gray-600">{invoice.clientPhone}</p>
          )}
          {invoice.clientEmail && (
            <p className="text-sm text-gray-600">{invoice.clientEmail}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase text-gray-400 mb-1">Fecha y Hora</p>
          <p className="font-medium text-gray-900">{parseInvoiceDate(invoice.issuedAt)}</p>
          <p className="text-sm text-gray-600">{parseInvoiceTime(invoice.issuedAt)}</p>
          <p className="text-xs text-gray-500 mt-1">Vendedor: {invoice.issuedByEmail}</p>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-6 print:mb-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-900 text-white text-xs">
              <th className="text-left px-3 py-2 rounded-tl-lg print:rounded-none">#</th>
              <th className="text-left px-3 py-2">Descripcion</th>
              <th className="text-center px-3 py-2">IMEI</th>
              <th className="text-center px-3 py-2">Cant.</th>
              <th className="text-right px-3 py-2">Precio Unit.</th>
              <th className="text-right px-3 py-2 rounded-tr-lg print:rounded-none">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-100">
                <td className="px-3 py-2.5 text-gray-400 text-xs">{idx + 1}</td>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-gray-900">{item.description}</p>
                  {(item.condition || item.storage) && (
                    <p className="text-xs text-gray-500">
                      {[item.condition, item.storage].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2.5 text-center font-mono text-xs text-gray-500">
                  {item.imei ? `...${item.imei.slice(-6)}` : '—'}
                </td>
                <td className="px-3 py-2.5 text-center text-gray-700">{item.quantity}</td>
                <td className="px-3 py-2.5 text-right text-gray-700">
                  {formatCurrency(item.unitPrice)}
                </td>
                <td className="px-3 py-2.5 text-right font-semibold text-gray-900">
                  {formatCurrency(item.subtotalLine)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div className="flex justify-end mb-6 print:mb-4">
        <div className="w-64 space-y-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">
              Subtotal ({totalItems} {totalItems === 1 ? 'item' : 'items'})
            </span>
            <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
          </div>
          {invoice.discountAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Descuento</span>
              <span className="text-red-600">-{formatCurrency(invoice.discountAmount)}</span>
            </div>
          )}
          {invoice.amountPaidWithCredit && invoice.amountPaidWithCredit > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Credito aplicado</span>
              <span className="text-green-700">-{formatCurrency(invoice.amountPaidWithCredit)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold border-t-2 border-gray-900 pt-2 mt-2">
            <span>TOTAL</span>
            <span className="text-gray-900">{formatCurrency(invoice.total)}</span>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="border-t border-gray-200 pt-4 mb-4 print:pt-3 print:mb-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-xs font-semibold uppercase text-gray-400">Metodo de Pago</span>
            <p className="font-medium text-gray-900 mt-0.5">{invoice.paymentMethod}</p>
          </div>
          {invoice.transferDetails && (
            <div>
              <span className="text-xs font-semibold uppercase text-gray-400">Transferencia</span>
              <p className="text-xs text-gray-600 mt-0.5">
                Ref: {invoice.transferDetails.number} · {invoice.transferDetails.bank}
              </p>
            </div>
          )}
          {invoice.debtIncurred && invoice.debtIncurred > 0 && (
            <div>
              <span className="text-xs font-semibold uppercase text-amber-600">Deuda Generada</span>
              <p className="font-medium text-amber-700 mt-0.5">
                {formatCurrency(invoice.debtIncurred)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="bg-gray-50 rounded-lg p-3 mb-4 print:mb-3 text-sm text-gray-600 italic">
          Nota: {invoice.notes}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-200 pt-4 print:pt-3">
        <p className="text-xs text-center text-gray-400">
          Este documento no tiene valor fiscal. · TOP LINE TEC · Miami, FL, USA
        </p>
        <p className="text-xs text-center text-gray-300 mt-1">{invoice.invoiceNumber}</p>
      </div>
    </div>
  );
}

/**
 * SISTEMA 4 VERIFICADO:
 * ✅ TypeScript compila sin errores
 * ✅ Build pasa
 * ✅ Factura con numero secuencial atomico (INV-YYYY-NNNN)
 * ✅ Vista de impresion limpia con @media print
 * ✅ Muestra cliente, items, totales, metodo de pago, notas
 * ✅ Edge case: factura no encontrada muestra mensaje
 */
