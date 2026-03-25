import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CreditCard, Loader2, AlertTriangle, Clock, MessageCircle, Building2, ArrowLeft } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../../lib/firebase';
import toast from 'react-hot-toast';
import {
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';

interface CheckoutItem {
  id: string;
  marca: string;
  modelo: string;
  storage?: string;
  condition?: string;
  precio: number;
  imei: string;
}

interface CheckoutModalProps {
  orderId: string;
  items: CheckoutItem[];
  subtotal: number;
  discount: number;
  total: number;
  reservedUntil: number; // epoch millis
  onClose: () => void;
  onSuccess: () => void;
}

export default function CheckoutModal({
  orderId,
  items,
  subtotal,
  discount,
  total,
  reservedUntil,
  onClose,
  onSuccess,
}: CheckoutModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const fns = getFunctions(app, 'us-central1');
  const navigate = useNavigate();

  // Countdown timer
  useEffect(() => {
    const update = () => setTimeLeft(Math.max(0, reservedUntil - Date.now()));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [reservedUntil]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  const isExpired = timeLeft === 0;

  // ── Stripe ──────────────────────────────────────────────────────────────────
  const handleStripe = useCallback(async () => {
    setLoading('stripe');
    try {
      const createCheckout = httpsCallable<
        { orderId: string; successUrl: string; cancelUrl: string },
        { checkoutUrl: string }
      >(fns, 'createStripeCheckout');

      const result = await createCheckout({
        orderId,
        successUrl: `${window.location.origin}/checkout/success`,
        cancelUrl: `${window.location.origin}/checkout/cancel`,
      });

      window.location.href = result.data.checkoutUrl;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al iniciar pago con Stripe';
      toast.error(msg);
      setLoading(null);
    }
  }, [fns, orderId]);

  // ── Transfer ─────────────────────────────────────────────────────────────────
  const handleTransfer = useCallback(async () => {
    setLoading('transfer');
    try {
      // Mark order as pending_transfer in Firestore
      const orderRef = doc(db, 'pendingOrders', orderId);
      await updateDoc(orderRef, {
        status: 'pending_transfer',
        paymentMethod: 'transfer',
        updatedAt: serverTimestamp(),
      });

      const lines = [
        '*Nuevo pedido Top Line Tec — Transferencia bancaria*',
        `Orden: ${orderId}`,
        '',
        '*Equipos:*',
        ...items.map((p) => `• ${p.marca} ${p.modelo}${p.storage ? ` ${p.storage}` : ''} — $${p.precio.toFixed(2)}`),
        '',
        `*Total a transferir: $${total.toFixed(2)}*`,
        '',
        'Adjunto comprobante de transferencia.',
      ].join('\n');

      const waNumber = import.meta.env.VITE_TOPLINE_WA_NUMBER || '17866593427';
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(lines)}`, '_blank');
      toast.success('Envía el comprobante por WhatsApp para confirmar tu pedido');
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar transferencia';
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  }, [orderId, items, total, onSuccess]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Confirmar Pedido</h2>
            <p className="text-xs text-gray-400 font-mono">
              #{orderId.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isExpired && (
              <div
                className={`flex items-center gap-1 text-sm font-bold tabular-nums ${
                  minutes < 5 ? 'text-red-500' : 'text-amber-500'
                }`}
              >
                <Clock className="w-4 h-4 shrink-0" />
                {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
              </div>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Reservation expired warning */}
          {isExpired && (
            <div className="flex flex-col gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  La reserva expiró. Regresa al catálogo y vuelve a apartar los equipos.
                </span>
              </div>
              <button
                onClick={() => { onClose(); navigate('/catalogo'); }}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Volver al Catálogo
              </button>
            </div>
          )}

          {/* Items list */}
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0"
              >
                <div className="min-w-0 mr-4">
                  <p className="text-sm font-semibold text-gray-900">
                    {item.marca} {item.modelo}
                    {item.storage ? ` · ${item.storage}` : ''}
                  </p>
                  <p className="text-xs text-gray-400">
                    {item.condition ? `${item.condition} · ` : ''}IMEI: {item.imei}
                  </p>
                </div>
                <p className="text-sm font-bold text-gray-900 shrink-0">
                  ${item.precio.toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600">
                <span>Descuento</span>
                <span>-${discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-200 pt-2 mt-2">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment methods */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-700">Elige tu método de pago</p>

            {/* Stripe */}
            <button
              onClick={handleStripe}
              disabled={!!loading || isExpired}
              className="w-full flex items-center justify-center gap-3 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors shadow-sm"
            >
              {loading === 'stripe' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CreditCard className="w-5 h-5" />
              )}
              Pagar con Tarjeta (Stripe)
            </button>

            {/* Bank Transfer */}
            <button
              onClick={handleTransfer}
              disabled={!!loading || isExpired}
              className="w-full flex items-center justify-center gap-3 py-3 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 rounded-xl font-semibold transition-colors text-sm"
            >
              {loading === 'transfer' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Building2 className="w-4 h-4" />
              )}
              Transferencia Bancaria / Zelle
            </button>

          </div>

          {/* Soporte */}
          <a
            href={`https://wa.me/${import.meta.env.VITE_TOPLINE_WA_NUMBER || '17866593427'}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-green-600 transition-colors mt-1"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            ¿Problemas? Escríbenos.
          </a>

          {/* Security note */}
          <p className="text-xs text-center text-gray-400">
            Pagos con tarjeta procesados de forma segura por Stripe · SSL 256-bit
          </p>
        </div>
      </div>
    </div>
  );
}
