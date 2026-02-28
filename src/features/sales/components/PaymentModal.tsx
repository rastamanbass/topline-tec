import { useState } from 'react';
import { useSalesStore } from '../stores/salesStore';
import { useSaleTransaction } from '../hooks/useSales';
import { useClients } from '../../clients/hooks/useClients';
import { X, Search, User, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

export default function PaymentModal() {
  const {
    isPaymentModalOpen,
    closePaymentModal,
    cartItems,
    selectedClient,
    setSelectedClient,
    paymentMethod,
    setPaymentMethod,
    discount,
    setDiscount,
    amountPaidWithCredit,
    setAmountPaidWithCredit,
    amountPaidWithWorkshopDebt,
    setAmountPaidWithWorkshopDebt,
    transferDetails,
    setTransferDetails,
    notes,
    setNotes,
    resetCheckout,
  } = useSalesStore();

  const { mutateAsync: executeSale, isPending } = useSaleTransaction();
  const { data: clients } = useClients(); // Only efficient if few clients, otherwise search implementation
  const [clientSearch, setClientSearch] = useState('');
  const [cashAmount, setCashAmount] = useState(0);
  const [transferAmount, setTransferAmount] = useState(0);
  // Filter clients for search
  const filteredClients = clientSearch
    ? clients?.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
    : [];

  const subtotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = Math.max(0, subtotal - discount);

  // Calculate debt incurred
  const remaining = total - amountPaidWithCredit - amountPaidWithWorkshopDebt;
  const paid = (cashAmount || 0) + (transferAmount || 0);
  const debtIncurred = Math.max(0, remaining - paid);

  const handlePayment = async () => {
    try {
      if (!selectedClient && (amountPaidWithCredit > 0 || amountPaidWithWorkshopDebt > 0)) {
        toast.error('Cliente requerido para créditos o deudas');
        return;
      }

      if (
        amountPaidWithCredit > 0 &&
        selectedClient &&
        amountPaidWithCredit > selectedClient.creditAmount
      ) {
        toast.error('El cliente no tiene suficiente crédito');
        return;
      }

      if (debtIncurred > 0 && !selectedClient) {
        toast.error('Debe seleccionar un cliente para generar deuda');
        return;
      }

      await executeSale({
        items: cartItems,
        clientId: selectedClient?.id || null,
        paymentMethod,
        discount,
        amountPaidWithCredit,
        amountPaidWithWorkshopDebt,
        debtIncurred,
        transferDetails: paymentMethod === 'Transferencia' ? transferDetails : undefined,
        notes,
      });

      toast.success('Venta realizada con éxito');
      resetCheckout();
      closePaymentModal();
    } catch (error: unknown) {
      console.error(error);
      toast.error(`Error en la venta: ${(error as Error).message}`);
    }
  };

  if (!isPaymentModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Finalizar Venta</h2>
          <button onClick={closePaymentModal} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Client Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
            {selectedClient ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="font-medium text-blue-900">{selectedClient.name}</span>
                  <span className="text-xs text-blue-600 ml-2">
                    (Crédito: ${selectedClient.creditAmount} | Deuda: ${selectedClient.debtAmount})
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

          {/* Totals Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal ({cartItems.length} items)</span>
              <span className="font-medium">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-gray-600">Descuento</span>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">-</span>
                <input
                  type="number"
                  className="w-20 p-1 border rounded text-right text-sm"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
              <span>Total a Pagar</span>
              <span className="text-primary-600">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Método de Pago</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {['Efectivo', 'Tarjeta', 'Transferencia', 'Cheque'].map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`px-3 py-2 rounded border text-sm font-medium transition-colors ${
                    paymentMethod === method
                      ? 'bg-primary-600 text-white border-primary-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>

            {paymentMethod === 'Transferencia' && (
              <div className="mt-3 grid grid-cols-1 gap-3 bg-gray-50 p-3 rounded">
                <input
                  placeholder="# Referencia"
                  className="input-field text-sm"
                  value={transferDetails.number}
                  onChange={(e) => setTransferDetails({ number: e.target.value })}
                />
                <input
                  placeholder="Banco"
                  className="input-field text-sm"
                  value={transferDetails.bank}
                  onChange={(e) => setTransferDetails({ bank: e.target.value })}
                />
              </div>
            )}
          </div>

          {/* Special Payments (Mixed) */}
          {selectedClient && (
            <div className="space-y-3 pt-4 border-t border-gray-100">
              <h3 className="text-sm font-medium text-gray-900">Pagos Especiales / Mixtos</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Usar Crédito a Favor</label>
                  <input
                    type="number"
                    className="input-field"
                    value={amountPaidWithCredit}
                    onChange={(e) => setAmountPaidWithCredit(Number(e.target.value))}
                    disabled={selectedClient.creditAmount <= 0}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Disp: ${selectedClient.creditAmount.toFixed(2)}
                  </p>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Cargar a Deuda Taller</label>
                  <input
                    type="number"
                    className="input-field"
                    value={amountPaidWithWorkshopDebt}
                    onChange={(e) => setAmountPaidWithWorkshopDebt(Number(e.target.value))}
                    disabled={!selectedClient.isWorkshopAccount}
                  />
                  {selectedClient.isWorkshopAccount ? (
                    <p className="text-xs text-purple-600 mt-1">Cuenta Taller Activa</p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">Solo cuentas taller</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Cash & Transfer Amounts */}
          <div className="space-y-3 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-medium text-gray-900">Montos Recibidos</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Efectivo Recibido</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={cashAmount}
                  onChange={(e) => setCashAmount(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Transferencia Recibida</label>
                <input
                  type="number"
                  step="0.01"
                  className="input-field"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Debt Warning */}
          {debtIncurred > 0 && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Se generara una deuda de {formatCurrency(debtIncurred)} para este cliente
                </p>
                {!selectedClient && (
                  <p className="text-xs text-red-600 mt-1 font-medium">
                    Debe seleccionar un cliente para poder generar deuda.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <textarea
              className="input-field"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles adicionales..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button onClick={closePaymentModal} className="btn-secondary">
              Cancelar
            </button>
            <button
              onClick={handlePayment}
              disabled={isPending}
              className="btn-primary flex items-center gap-2"
            >
              {isPending && <span className="animate-spin">⌛</span>}
              Confirmar Venta (${total.toFixed(2)})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
