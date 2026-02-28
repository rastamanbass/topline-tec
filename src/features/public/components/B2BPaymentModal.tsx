import { useState } from 'react';
import { X, User, Search, CreditCard, Loader2 } from 'lucide-react';
import { useClients } from '../../clients/hooks/useClients';
import type { Phone, Client } from '../../../types';
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
  const { data: clients } = useClients();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientSearch, setClientSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('pending');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Guest client fields
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [useGuest, setUseGuest] = useState(false);

  const filteredClients = clientSearch
    ? clients?.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
    : [];

  const subtotal = reservedPhones.reduce((sum, p) => sum + p.precioVenta, 0);
  const total = Math.max(0, subtotal - discount);

  const handleConfirm = async () => {
    try {
      setIsProcessing(true);

      if (!useGuest && !selectedClient) {
        toast.error('Selecciona un cliente o usa "Cliente Invitado"');
        return;
      }

      if (useGuest && !guestName) {
        toast.error('Ingresa el nombre del cliente');
        return;
      }

      await onConfirm({
        clientId: selectedClient?.id,
        clientAlias: useGuest ? guestName : undefined,
        clientEmail: useGuest ? guestEmail : undefined,
        clientPhone: useGuest ? guestPhone : undefined,
        paymentMethod,
        discount,
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

          {/* Client Selection Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setUseGuest(false)}
              className={`flex-1 px-4 py-2 rounded-lg border font-medium transition-colors ${
                !useGuest
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Cliente Registrado
            </button>
            <button
              onClick={() => setUseGuest(true)}
              className={`flex-1 px-4 py-2 rounded-lg border font-medium transition-colors ${
                useGuest
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Cliente Invitado
            </button>
          </div>

          {/* Client Selection */}
          {!useGuest ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
              {selectedClient ? (
                <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-blue-900">{selectedClient.name}</span>
                    <span className="text-xs text-blue-600 ml-2">
                      (Crédito: ${selectedClient.creditAmount} | Deuda: ${selectedClient.debtAmount}
                      )
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedClient(null)}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    className="input-field pl-10"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                  />
                  <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
                  {clientSearch && filteredClients && filteredClients.length > 0 && (
                    <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-40 overflow-y-auto">
                      {filteredClients.map((client) => (
                        <div
                          key={client.id}
                          className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                          onClick={() => {
                            setSelectedClient(client);
                            setClientSearch('');
                          }}
                        >
                          <p className="font-medium text-sm">{client.name}</p>
                          <p className="text-xs text-gray-500">{client.email || client.phone}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
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
                  placeholder="Nombre del cliente"
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
          )}

          {/* Discount */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-gray-600">Descuento</span>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">-$</span>
                <input
                  type="number"
                  className="w-24 p-1 border rounded text-right text-sm"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  min="0"
                  max={subtotal}
                />
              </div>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
              <span>Total</span>
              <span className="text-primary-600">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Estado del Pago</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaymentMethod('pending')}
                className={`px-3 py-2 rounded border text-sm font-medium transition-colors ${
                  paymentMethod === 'pending'
                    ? 'bg-yellow-600 text-white border-yellow-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Pendiente
              </button>
              <button
                onClick={() => setPaymentMethod('paid')}
                className={`px-3 py-2 rounded border text-sm font-medium transition-colors ${
                  paymentMethod === 'paid'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Pagado
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {paymentMethod === 'pending'
                ? 'El pedido se creará como pendiente de pago'
                : 'El pedido se marcará como pagado inmediatamente'}
            </p>
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
              Confirmar Pedido (${total.toFixed(2)})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
