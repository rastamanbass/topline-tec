import { useState, useEffect, useRef } from 'react';
import { useSalesStore } from '../stores/salesStore';
import { useSaleTransaction } from '../hooks/useSales';
import { useClients } from '../../clients/hooks/useClients';
import { useModal } from '../../../hooks/useModal';
import { X, Search, User, AlertTriangle, CheckCircle, Trash2, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '../../../lib/firebase';
import { lockPhonesForPOS, unlockPhonesFromPOS } from '../../../services/firebase/stockLock';
import { createInvoice } from '../../../services/firebase/invoiceService';
import type { CreateInvoiceData } from '../../../services/firebase/invoiceService';
import { phoneLabel } from '../../../lib/phoneUtils';
import InvoiceModal from '../../invoices/components/InvoiceModal';

const round2 = (n: number) => Math.round(n * 100) / 100;
const formatCurrency = (amount: number) => `$${amount.toFixed(2)}`;

export default function PaymentModal() {
  const {
    isPaymentModalOpen,
    closePaymentModal,
    cartItems,
    removeFromCart,
    updateCartItemPrice,
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
  const { data: clients } = useClients();
  const { dialogRef } = useModal(closePaymentModal, { disabled: isPending });
  const [clientSearch, setClientSearch] = useState('');
  const [cashAmount, setCashAmount] = useState(0);
  const [transferAmount, setTransferAmount] = useState(0);

  // Invoice state
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [saleSuccess, setSaleSuccess] = useState(false);

  // Track if lock was acquired for cleanup
  const lockedPhoneIds = useRef<string[]>([]);

  const phoneIds = cartItems.filter((i) => i.phoneId).map((i) => i.phoneId!);

  // Lock phones when modal opens
  useEffect(() => {
    if (!isPaymentModalOpen || phoneIds.length === 0) return;
    let cancelled = false;

    lockPhonesForPOS(phoneIds)
      .then(() => {
        if (!cancelled) lockedPhoneIds.current = phoneIds;
      })
      .catch((err: Error) => {
        if (!cancelled) {
          toast.error(err.message);
          resetCheckout();
          closePaymentModal();
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaymentModalOpen]);

  const filteredClients = clientSearch
    ? clients?.filter((c) => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
    : [];

  const subtotal = round2(cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0));
  const total = round2(Math.max(0, subtotal - discount));

  const remaining = round2(total - amountPaidWithCredit - amountPaidWithWorkshopDebt);
  const paid = round2((cashAmount || 0) + (transferAmount || 0));
  const debtIncurred = round2(Math.max(0, remaining - paid));

  const handleCancel = async () => {
    // Unlock phones reserved for this POS checkout
    if (lockedPhoneIds.current.length > 0) {
      try {
        await unlockPhonesFromPOS(lockedPhoneIds.current);
      } catch {
        // Non-critical — log only
        console.warn('Could not unlock phones on cancel');
      }
      lockedPhoneIds.current = [];
    }
    closePaymentModal();
  };

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

      const result = await executeSale({
        items: cartItems,
        clientId: selectedClient?.id || '',
        paymentMethod,
        totalAmount: total,
        discountAmount: discount,
        amountPaidWithCredit,
        amountPaidWithWorkshopDebt,
        debtIncurred,
        transferDetails: paymentMethod === 'Transferencia' ? transferDetails : undefined,
        notes,
      });

      if (!result.success) {
        toast.error(result.error || 'Error en la venta');
        return;
      }

      // Build invoice items from cart
      const invoiceItems: CreateInvoiceData['items'] = cartItems.map((item) => ({
        description: item.description || phoneLabel(undefined, item.description),
        imei: item.imei,
        quantity: item.quantity,
        unitPrice: item.price,
        subtotalLine: round2(item.price * item.quantity),
      }));

      // Create invoice
      try {
        const invoiceData: CreateInvoiceData = {
          clientId: selectedClient?.id,
          clientName: selectedClient?.name || 'Venta al contado',
          clientPhone: selectedClient?.phone,
          clientEmail: selectedClient?.email,
          items: invoiceItems,
          subtotal,
          discountAmount: discount,
          total,
          paymentMethod,
          amountPaidWithCredit: amountPaidWithCredit || undefined,
          amountPaidWithWorkshopDebt: amountPaidWithWorkshopDebt || undefined,
          debtIncurred: debtIncurred || undefined,
          transferDetails:
            paymentMethod === 'Transferencia' ? transferDetails : undefined,
          cashAmount: cashAmount || undefined,
          notes: notes || undefined,
          phoneIds,
          source: 'pos',
        };
        const newInvoiceId = await createInvoice(invoiceData);
        setInvoiceId(newInvoiceId);
        // Get number for display — we'll show it from the modal
      } catch (invoiceError) {
        console.error('Invoice creation failed:', invoiceError);
        // Don't fail the sale if invoice fails — log only
        toast.error('Venta guardada, pero la factura no se pudo generar.');
      }

      lockedPhoneIds.current = [];
      toast.success('Venta realizada con exito');
      setSaleSuccess(true);
    } catch (error: unknown) {
      console.error(error);
      toast.error(`Error en la venta: ${(error as Error).message}`);
    }
  };

  const handleClose = () => {
    resetCheckout();
    setSaleSuccess(false);
    setInvoiceId(null);
    lockedPhoneIds.current = [];
    closePaymentModal();
  };

  // If cart becomes empty (user removed all items), close modal
  useEffect(() => {
    if (isPaymentModalOpen && cartItems.length === 0 && !saleSuccess) {
      closePaymentModal();
    }
  }, [cartItems.length, isPaymentModalOpen, saleSuccess, closePaymentModal]);

  if (!isPaymentModalOpen) return null;

  // Success state — auto-show invoice with all actions (Print, PDF, WhatsApp, Close)
  if (saleSuccess) {
    // If invoice exists, show it directly — no extra click needed
    if (invoiceId) {
      return (
        <InvoiceModal
          invoiceId={invoiceId}
          onClose={handleClose}
          isNewInvoice
        />
      );
    }

    // Fallback: invoice creation failed — show simple success card
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-8 flex flex-col items-center gap-5">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Venta Registrada</h2>
            <p className="text-gray-500 mt-1">Total: {formatCurrency(total)}</p>
          </div>
          <button
            onClick={handleClose}
            className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-sale-title"
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 id="payment-sale-title" className="text-xl font-bold text-gray-900">
            Finalizar Venta
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Cerrar"
          >
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

          {/* Cart Items */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Equipos en carrito ({cartItems.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cartItems.map((item, index) => (
                <div
                  key={item.imei || item.id || index}
                  className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.description}
                      </p>
                      {item.imei && (
                        <p className="text-xs text-gray-400 font-mono">{item.imei}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-gray-400">$</span>
                      <input
                        type="number"
                        value={item.price}
                        onChange={(e) => {
                          const newPrice = parseFloat(e.target.value) || 0;
                          updateCartItemPrice(index, newPrice, item.discountReason || '', auth.currentUser?.email || 'unknown');
                        }}
                        className="w-16 text-sm font-bold text-gray-900 bg-white border border-gray-200 rounded px-1 py-0.5 text-right"
                        step="1"
                        min={0}
                      />
                    </div>
                    <button
                      onClick={() => removeFromCart(index)}
                      className="shrink-0 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Quitar del carrito"
                      aria-label={`Quitar ${item.description}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {/* Discount info when price was modified */}
                  {item.originalPrice != null && item.originalPrice !== item.price && (
                    <div className="mt-1 ml-7 flex items-center gap-2">
                      <span className="text-xs text-gray-400 line-through">${item.originalPrice}</span>
                      <span className="text-xs font-medium text-green-600">
                        -{(item.originalPrice - item.price).toFixed(0)}
                      </span>
                      <input
                        type="text"
                        value={item.discountReason || ''}
                        onChange={(e) => updateCartItemPrice(index, item.price, e.target.value, auth.currentUser?.email || 'unknown')}
                        placeholder="Razón del descuento..."
                        className="flex-1 text-xs border-b border-gray-200 bg-transparent px-1 py-0.5 focus:border-blue-400 outline-none"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
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
                  min="0"
                  max={subtotal}
                  step="0.01"
                  onChange={(e) =>
                    setDiscount(Math.max(0, Math.min(subtotal, Number(e.target.value))))
                  }
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
                    disabled={!selectedClient.creditAmount || selectedClient.creditAmount <= 0}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Disp: ${(selectedClient.creditAmount ?? 0).toFixed(2)}
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
            <button onClick={handleCancel} className="btn-secondary">
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

/**
 * SISTEMA 3 VERIFICADO:
 * ✅ Lock atómico al abrir modal (lockPhonesForPOS)
 * ✅ Unlock al cancelar (unlockPhonesFromPOS)
 * ✅ Verificación atómica en transactions.ts antes de vender
 * ✅ Estado de éxito con botón de factura
 * ✅ Edge case: si lock falla, cierra modal con toast.error
 */
