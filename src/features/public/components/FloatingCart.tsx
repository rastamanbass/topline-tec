import { useState } from 'react';
import { ShoppingCart, CreditCard } from 'lucide-react';
import { collection, addDoc, serverTimestamp, Timestamp, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Phone } from '../../../types';
import B2BPaymentModal from './B2BPaymentModal';
import toast from 'react-hot-toast';

interface FloatingCartProps {
    reservedPhones: Phone[];
    sessionId: string;
    timeLeft: number; // For future countdown
}

export default function FloatingCart({ reservedPhones, sessionId }: FloatingCartProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    if (reservedPhones.length === 0) return null;

    const total = reservedPhones.reduce((sum, p) => sum + p.precioVenta, 0);
    const count = reservedPhones.length;

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
            const finalTotal = Math.max(0, total - data.discount);

            // Create PendingOrder
            const orderRef = await addDoc(collection(db, 'pendingOrders'), {
                sessionId,
                clientId: data.clientId || null,
                clientAlias: data.clientAlias || null,
                clientEmail: data.clientEmail || null,
                clientPhone: data.clientPhone || null,
                phoneIds: reservedPhones.map(p => p.id),
                phones: reservedPhones.map(p => ({
                    id: p.id,
                    marca: p.marca,
                    modelo: p.modelo,
                    precio: p.precioVenta,
                    imei: p.imei,
                    condition: p.condition || 'Grade A',
                })),
                subtotal: total,
                discountAmount: data.discount,
                total: finalTotal,
                paymentMethod: data.paymentMethod,
                status: data.paymentMethod === 'paid' ? 'paid' : 'pending_payment',
                createdAt: serverTimestamp(),
                reservedUntil: Timestamp.fromMillis(Date.now() + 30 * 60 * 1000),
                paidAt: data.paymentMethod === 'paid' ? serverTimestamp() : null,
                notes: data.notes || null,
            });

            // Update phones with orderId and change status if paid
            const batch = writeBatch(db);
            reservedPhones.forEach(phone => {
                const phoneRef = doc(db, 'phones', phone.id);
                batch.update(phoneRef, {
                    'reservation.orderId': orderRef.id,
                    ...(data.paymentMethod === 'paid' && {
                        estado: 'Pagado',
                        reservation: null,
                    }),
                });
            });
            await batch.commit();

            // Generate WhatsApp message
            const statusText = data.paymentMethod === 'paid' ? 'PAGADO' : 'PENDIENTE DE PAGO';
            const clientName = data.clientAlias || 'Cliente';
            const msg = `🎉 *Pedido Confirmado* - ${statusText}\\n\\n` +
                `👤 Cliente: ${clientName}\\n` +
                `📦 Equipos: ${count}\\n` +
                `💰 Total: $${finalTotal.toLocaleString()}\\n\\n` +
                `*Detalle:*\\n` +
                reservedPhones.map(p => `• ${p.modelo} - $${p.precioVenta}`).join('\\n') +
                `\\n\\n📋 ID Pedido: ${orderRef.id}`;

            const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
            window.open(whatsappUrl, '_blank');

            setIsModalOpen(false);
        } catch (error: any) {
            console.error('Error creating order:', error);
            throw new Error(error.message || 'Error al crear el pedido');
        }
    };

    return (
        <>
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
                            <p className="text-2xl font-bold text-gray-900">${total.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Timer (Visual Only for now) */}
                    <div className="hidden md:block text-center">
                        <p className="text-xs text-orange-600 font-bold uppercase tracking-wide animate-pulse">
                            Reserva activa por 30 min
                        </p>
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="w-full sm:w-auto bg-primary-600 hover:bg-primary-700 text-white font-bold py-3 px-8 rounded-xl flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary-200"
                    >
                        <CreditCard className="w-5 h-5" />
                        Confirmar Pedido
                    </button>
                </div>
            </div>

            <B2BPaymentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                reservedPhones={reservedPhones}
                sessionId={sessionId}
                onConfirm={handleCreateOrder}
            />
        </>
    );
}
