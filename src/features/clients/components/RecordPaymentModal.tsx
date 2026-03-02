import { useState } from 'react';
import { X, DollarSign, Loader2 } from 'lucide-react';
import { useRecordDebtPayment } from '../hooks/useClients';
import { useModal } from '../../../hooks/useModal';
import type { Client } from '../../../types';

type PaymentMethod = 'Efectivo' | 'Transferencia' | 'Cheque' | 'Otro';

const METHODS: PaymentMethod[] = ['Efectivo', 'Transferencia', 'Cheque', 'Otro'];

const REFERENCE_PLACEHOLDER: Record<PaymentMethod, string> = {
  Efectivo: 'Número de recibo (opcional)',
  Transferencia: 'Número de referencia (recomendado)',
  Cheque: 'Número de cheque (recomendado)',
  Otro: 'Referencia (opcional)',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

interface Props {
  client: Client;
  onClose: () => void;
}

export default function RecordPaymentModal({ client, onClose }: Props) {
  const recordPayment = useRecordDebtPayment();
  const { dialogRef } = useModal(onClose, { disabled: recordPayment.isPending });

  const [amountStr, setAmountStr] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('Efectivo');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const amount = parseFloat(amountStr) || 0;
  const remaining = Math.max(0, client.debtAmount - amount);
  const isValid = amount > 0 && amount <= client.debtAmount + 0.001;
  const isRecommendedRef = method === 'Transferencia' || method === 'Cheque';

  const handleSubmit = async () => {
    if (!isValid) return;
    try {
      await recordPayment.mutateAsync({
        clientId: client.id,
        amount,
        paymentMethod: method,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch {
      // error already toasted by hook
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-modal-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 id="payment-modal-title" className="text-lg font-bold text-gray-900">Registrar Pago</h2>
            <p className="text-sm text-gray-500">{client.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Current debt */}
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-red-700 font-medium">Deuda pendiente</p>
            <p className="text-2xl font-bold text-red-700">{fmt(client.debtAmount)}</p>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Monto a pagar
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
                $
              </span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                max={client.debtAmount}
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-4 py-3 border border-gray-200 rounded-xl text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoFocus
              />
            </div>
            {amount > 0 && (
              <p
                className={`text-sm font-medium mt-1.5 ${
                  remaining === 0 ? 'text-emerald-600' : 'text-gray-500'
                }`}
              >
                {remaining === 0
                  ? '✓ Saldo quedará en $0.00'
                  : `Saldo restante: ${fmt(remaining)}`}
              </p>
            )}
            {amount > client.debtAmount + 0.001 && (
              <p className="text-sm text-red-500 mt-1">
                El monto excede la deuda actual
              </p>
            )}
          </div>

          {/* Method */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Método de pago
            </label>
            <div className="grid grid-cols-4 gap-2">
              {METHODS.map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`py-2 px-1 text-sm font-medium rounded-xl border transition-all ${
                    method === m
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Reference */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Referencia{' '}
              {isRecommendedRef && (
                <span className="text-xs text-amber-600 font-normal">
                  · Recomendado para trazabilidad
                </span>
              )}
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={REFERENCE_PLACEHOLDER[method]}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Notas <span className="text-xs text-gray-400 font-normal">· opcional</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observaciones adicionales..."
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid || recordPayment.isPending}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
          >
            {recordPayment.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <DollarSign className="w-4 h-4" />
            )}
            {amount > 0 && isValid ? `Registrar ${fmt(amount)}` : 'Registrar Pago'}
          </button>
        </div>
      </div>
    </div>
  );
}
