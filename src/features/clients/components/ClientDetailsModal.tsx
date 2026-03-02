import { useState } from 'react';
import { X, Calendar, DollarSign, Package, CreditCard, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useClientPurchases, useDebtHistory } from '../hooks/useClients';
import RecordPaymentModal from './RecordPaymentModal';
import { useModal } from '../../../hooks/useModal';
import type { Client } from '../../../types';

interface ClientDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const fmtDate = (date: Date) =>
  new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium', timeStyle: 'short' }).format(date);

export default function ClientDetailsModal({ isOpen, onClose, client }: ClientDetailsModalProps) {
  const { data: purchases, isLoading: purchasesLoading } = useClientPurchases(client.id);
  const { data: debtHistory, isLoading: historyLoading } = useDebtHistory(client.id);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const { dialogRef } = useModal(onClose, { disabled: !isOpen || showPaymentModal });

  if (!isOpen) return null;

  const netPosition = (client.creditAmount || 0) - (client.debtAmount || 0);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="client-details-title"
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 id="client-details-title" className="text-xl font-bold text-gray-900">{client.name}</h2>
              <p className="text-sm text-gray-400 mt-0.5">{client.email || client.phone || '—'}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-8">
            {/* ── Financial Position ─────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Credit */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="bg-emerald-100 p-1.5 rounded-full">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Crédito disponible</p>
                </div>
                <p className="text-2xl font-bold text-emerald-700">{fmt(client.creditAmount || 0)}</p>
              </div>

              {/* Debt */}
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="bg-red-100 p-1.5 rounded-full">
                    <DollarSign className="w-4 h-4 text-red-600" />
                  </div>
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Deuda actual</p>
                </div>
                <p className="text-2xl font-bold text-red-700">{fmt(client.debtAmount || 0)}</p>
                {(client.debtAmount || 0) > 0 && (
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="mt-2 w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <CreditCard className="w-3 h-3" />
                    Registrar pago
                  </button>
                )}
              </div>

              {/* Net position */}
              <div className={`border rounded-xl p-4 ${netPosition >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`p-1.5 rounded-full ${netPosition >= 0 ? 'bg-blue-100' : 'bg-orange-100'}`}>
                    <DollarSign className={`w-4 h-4 ${netPosition >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
                  </div>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${netPosition >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                    Posición neta
                  </p>
                </div>
                <p className={`text-2xl font-bold ${netPosition >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                  {fmt(Math.abs(netPosition))}
                </p>
                <p className={`text-xs mt-0.5 ${netPosition >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>
                  {netPosition >= 0 ? 'A favor del cliente' : 'Saldo pendiente'}
                </p>
              </div>
            </div>

            {/* ── Debt Movement History ──────────────────────────────── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <ArrowDownCircle className="w-4 h-4" />
                Historial de movimientos de deuda
              </h3>

              {historyLoading ? (
                <div className="animate-pulse space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-14 bg-gray-100 rounded-xl" />
                  ))}
                </div>
              ) : debtHistory && debtHistory.length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="divide-y divide-gray-50">
                    {debtHistory.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                        <div className={`p-1.5 rounded-full shrink-0 ${entry.type === 'payment' ? 'bg-emerald-100' : 'bg-blue-100'}`}>
                          {entry.type === 'payment' ? (
                            <ArrowDownCircle className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <ArrowUpCircle className="w-4 h-4 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            {entry.type === 'payment'
                              ? `Pago — ${entry.paymentMethod || ''}`
                              : `Ajuste — ${entry.reason || ''}`}
                          </p>
                          <p className="text-xs text-gray-400">
                            {fmtDate(entry.date)}
                            {entry.reference ? ` · Ref: ${entry.reference}` : ''}
                            {(entry.createdBy || entry.adjustedBy)
                              ? ` · ${entry.createdBy || entry.adjustedBy}`
                              : ''}
                          </p>
                          {entry.notes && (
                            <p className="text-xs text-gray-500 italic mt-0.5">{entry.notes}</p>
                          )}
                        </div>
                        <p className={`text-sm font-bold shrink-0 ${entry.type === 'payment' ? 'text-emerald-600' : 'text-blue-600'}`}>
                          -{fmt(entry.amount)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                  Sin movimientos de deuda registrados
                </div>
              )}
            </div>

            {/* ── Purchase History ───────────────────────────────────── */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Historial de compras
              </h3>

              {purchasesLoading ? (
                <p className="text-sm text-gray-400">Cargando historial...</p>
              ) : purchases && purchases.length > 0 ? (
                <div className="space-y-3">
                  {(
                    purchases as Array<{
                      id: string;
                      purchaseDate: Date;
                      totalAmount: number;
                      items: { description?: string; imei?: string; quantity: number }[];
                      paymentMethod: string;
                      amountPaidWithCredit?: number;
                    }>
                  ).map((purchase) => (
                    <div
                      key={purchase.id}
                      className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">
                            Compra #{purchase.id.slice(0, 6)}
                          </p>
                          <p className="text-xs text-gray-400">{fmtDate(purchase.purchaseDate)}</p>
                        </div>
                        <span className="font-bold text-gray-900 text-sm">
                          {fmt(purchase.totalAmount)}
                        </span>
                      </div>

                      <div className="text-sm text-gray-600 mt-2 space-y-1">
                        {purchase.items.map((item, idx: number) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Package className="w-3 h-3 text-gray-400" />
                            <span className="text-xs">{item.description || item.imei}</span>
                            <span className="text-xs text-gray-400">x{item.quantity}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 flex gap-2 flex-wrap">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded-lg">
                          {purchase.paymentMethod}
                        </span>
                        {(purchase.amountPaidWithCredit ?? 0) > 0 && (
                          <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-lg">
                            Crédito: {fmt(purchase.amountPaidWithCredit ?? 0)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
                  No hay historial de compras
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal (z-[60] so it renders above this modal) */}
      {showPaymentModal && (
        <RecordPaymentModal
          client={client}
          onClose={() => setShowPaymentModal(false)}
        />
      )}
    </>
  );
}
