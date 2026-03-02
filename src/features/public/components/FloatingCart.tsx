import { useState } from 'react';
import { ShoppingCart, CreditCard } from 'lucide-react';
import {
  collection,
  serverTimestamp,
  Timestamp,
  doc,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Phone } from '../../../types';
import B2BPaymentModal from './B2BPaymentModal';
import CheckoutModal from './CheckoutModal';
import { useAuth } from '../../../context';

interface FloatingCartProps {
  reservedPhones: Phone[];
  sessionId: string;
  timeLeft: number;
}

export default function FloatingCart({ reservedPhones, sessionId, timeLeft }: FloatingCartProps) {
  const { user } = useAuth();
  const [isB2BModalOpen, setIsB2BModalOpen] = useState(false);
  const [checkoutData, setCheckoutData] = useState<{
    orderId: string;
    subtotal: number;
    discount: number;
    total: number;
    reservedUntil: number;
  } | null>(null);

  if (reservedPhones.length === 0) return null;

  const subtotal = reservedPhones.reduce((sum, p) => sum + p.precioVenta, 0);
  const count = reservedPhones.length;

  // Step 1: Create the PendingOrder in Firestore, return orderId + metadata
  const handleCreateOrder = async (data: {
    clientId?: string;
    clientAlias?: string;
    clientEmail?: string;
    clientPhone?: string;
    paymentMethod: string;
    discount: number;
    notes: string;
  }) => {
    try {
      const finalTotal = Math.max(0, subtotal - data.discount);
      const reservedUntilMillis = Date.now() + 30 * 60 * 1000;

      const orderRef = doc(collection(db, 'pendingOrders'));

      await runTransaction(db, async (transaction) => {
        // 1. Verify reservations still valid for this session
        const phoneSnapshots = await Promise.all(
          reservedPhones.map(async (phone) => {
            const phoneRef = doc(db, 'phones', phone.id);
            const phoneSnap = await transaction.get(phoneRef);
            return { phone, phoneRef, phoneSnap };
          })
        );

        for (const { phone, phoneSnap } of phoneSnapshots) {
          if (!phoneSnap.exists()) {
            throw new Error(`El teléfono ${phone.modelo} ya no existe en el inventario.`);
          }
          const phoneData = phoneSnap.data();
          if (
            phoneData.estado !== 'Apartado' ||
            !phoneData.reservation ||
            phoneData.reservation.reservedBy !== sessionId
          ) {
            throw new Error(
              `El teléfono ${phone.modelo} ya no está reservado por esta sesión.`
            );
          }
        }

        // 2. Create the pendingOrder document with status 'reserved'
        transaction.set(orderRef, {
          sessionId,
          clientId: user?.clientId || data.clientId || null,
          clientAlias: user?.displayName || data.clientAlias || null,
          clientEmail: user?.email || data.clientEmail || null,
          clientPhone: data.clientPhone || null,
          phoneIds: reservedPhones.map((p) => p.id),
          phones: reservedPhones.map((p) => ({
            id: p.id,
            marca: p.marca,
            modelo: p.modelo,
            precio: p.precioVenta,
            imei: p.imei,
            condition: p.condition || 'Grade A',
            storage: p.storage || null,
          })),
          subtotal,
          discountAmount: data.discount,
          total: finalTotal,
          paymentMethod: null,
          status: 'reserved',
          source: 'online',
          createdAt: serverTimestamp(),
          reservedUntil: Timestamp.fromMillis(reservedUntilMillis),
          paidAt: null,
          notes: data.notes || null,
        });

        // 3. Link orderId to phone reservations
        for (const { phoneRef } of phoneSnapshots) {
          transaction.update(phoneRef, {
            'reservation.orderId': orderRef.id,
            updatedAt: serverTimestamp(),
          });
        }
      });

      // Step 2: Open CheckoutModal with orderId and payment metadata
      setCheckoutData({
        orderId: orderRef.id,
        subtotal,
        discount: data.discount,
        total: finalTotal,
        reservedUntil: reservedUntilMillis,
      });
      setIsB2BModalOpen(false);
    } catch (error: unknown) {
      console.error('Error creating order:', error);
      throw new Error((error as Error).message || 'Error al crear el pedido');
    }
  };

  return (
    <>
      {/* Floating bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 z-50 animate-slide-up">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-primary-100 p-3 rounded-full relative">
              <ShoppingCart className="w-6 h-6 text-primary-600" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {count}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Estimado</p>
              <p className="text-2xl font-bold text-gray-900">${subtotal.toLocaleString()}</p>
            </div>
          </div>

          <div className="hidden md:block text-center">
            <p className="text-xs text-orange-600 font-bold uppercase tracking-wide animate-pulse">
              {timeLeft ? `Reserva activa · ${Math.ceil(timeLeft / 60000)}m restantes` : 'Reserva activa'}
            </p>
          </div>

          <button
            onClick={() => setIsB2BModalOpen(true)}
            className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-8 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary-200"
          >
            <CreditCard className="w-5 h-5" />
            Confirmar Pedido
          </button>
        </div>
      </div>

      {/* Step 1: B2B modal — collects client info + discount, creates the order */}
      <B2BPaymentModal
        isOpen={isB2BModalOpen}
        onClose={() => setIsB2BModalOpen(false)}
        reservedPhones={reservedPhones}
        sessionId={sessionId}
        onConfirm={handleCreateOrder}
      />

      {/* Step 2: CheckoutModal — payment method selection */}
      {checkoutData && (
        <CheckoutModal
          orderId={checkoutData.orderId}
          items={reservedPhones.map((p) => ({
            id: p.id,
            marca: p.marca,
            modelo: p.modelo,
            storage: p.storage,
            condition: p.condition,
            precio: p.precioVenta,
            imei: p.imei,
          }))}
          subtotal={checkoutData.subtotal}
          discount={checkoutData.discount}
          total={checkoutData.total}
          reservedUntil={checkoutData.reservedUntil}
          onClose={() => setCheckoutData(null)}
          onSuccess={() => {
            setCheckoutData(null);
          }}
        />
      )}
    </>
  );
}
