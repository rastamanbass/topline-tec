import { useState } from 'react';
import { X, CreditCard, Loader2 } from 'lucide-react';
import type { Phone } from '../../../types';
import toast from 'react-hot-toast';

interface B2BPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservedPhones: Phone[];
  sessionId: string;
  onConfirm: (data: {
    clientId?: string;
    clientAlias?: string;
    clientEmail?: string;
    clientPhone?: string;
    paymentMethod: string;
    discount: number;
    notes: string;
  }) => Promise<void>;
}

export default function B2BPaymentModal({
  isOpen,
  onClose,
  reservedPhones,
  // sessionId,
  onConfirm,
}: B2BPaymentModalProps) {
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Compradores públicos siempre operan como invitados
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');

  const subtotal = reservedPhones.reduce((sum, p) => sum + p.precioVenta, 0);

  const handleConfirm = async () => {
    try {
      setIsProcessing(true);

      if (!guestName) {
        toast.error('Ingresa el nombre del cliente');
        return;
      }

      await onConfirm({
        clientAlias: guestName,
        clientEmail: guestEmail || undefined,
        clientPhone: guestPhone || undefined,
        paymentMethod: 'pending',
        discount: 0,
        notes,
      });

      toast.success('Pedido creado exitosamente');
      onClose();
    } catch (error: unknown) {
      toast.error((error as Error).message || 'Error al crear el pedido');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Confirmar Pedido B2B</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Order Summary */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Resumen del Pedido</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-700">Teléfonos:</span>
                <span className="font-medium">{reservedPhones.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-700">Subtotal:</span>
                <span className="font-medium">${subtotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Datos del comprador (siempre modo invitado — no se exponen datos internos) */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="input-field"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Nombre del comprador"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  className="input-field"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="email@ejemplo.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                <input
                  type="tel"
                  className="input-field"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="+503 1234-5678"
                />
              </div>
            </div>
          </div>

          {/* Total */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span className="text-primary-600">${subtotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              className="input-field"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles adicionales del pedido..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="btn-primary flex items-center gap-2"
            >
              {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
              <CreditCard className="w-4 h-4" />
              Confirmar Pedido (${subtotal.toFixed(2)})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
