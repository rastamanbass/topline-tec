import { useState, useEffect } from 'react';
import { X, Minus, Plus, Trash2, Search, Bot, Send } from 'lucide-react';
import { useModal } from '../../../hooks/useModal';
import { useFritzStore } from '../stores/fritzStore';
import { useFritz } from '../hooks/useFritz';
import type { SalePreviewItem } from '../types';

const PAYMENT_METHODS = [
  { id: 'Efectivo', label: 'Efectivo', icon: '💵' },
  { id: 'Tarjeta', label: 'Tarjeta', icon: '💳' },
  { id: 'Transferencia', label: 'Transfer.', icon: '🏦' },
  { id: 'Credito', label: 'Crédito', icon: '💰' },
];

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 0 })}`;

export function FritzSaleModal() {
  const { salePreview, setSalePreview, isLoading } = useFritzStore();
  const { addToSale, sendMessage } = useFritz();
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [items, setItems] = useState<SalePreviewItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [fritzInput, setFritzInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  const { dialogRef } = useModal(() => handleClose(), { disabled: isExecuting });

  // Sync items from preview when it changes (only on first load — preserve user edits)
  useEffect(() => {
    if (salePreview && salePreview.items.length > 0) {
      setItems((prev) => (prev.length === 0 ? [...salePreview.items] : prev));
    }
  }, [salePreview]);

  if (!salePreview) return null;

  const handleClose = () => {
    setSalePreview(null);
    setItems([]);
    setSearchQuery('');
    setFritzInput('');
    setPaymentMethod('Efectivo');
  };

  const updateItemQuantity = (index: number, delta: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const newQty = Math.max(1, Math.min(item.phoneIds.length, item.quantity + delta));
        return {
          ...item,
          quantity: newQty,
          total: newQty * item.pricePerUnit,
        };
      })
    );
  };

  const updateItemPrice = (index: number, newPrice: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          pricePerUnit: newPrice,
          total: item.quantity * newPrice,
        };
      })
    );
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const grandTotal = items.reduce((sum, item) => sum + item.total, 0);
  const totalPhones = items.reduce((sum, item) => sum + item.quantity, 0);

  const filteredSuggestions = (salePreview.availableModels || []).filter((m) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return m.modelo.toLowerCase().includes(q) || m.marca.toLowerCase().includes(q);
  });

  const handleAddSuggestion = (modelo: string, marca: string, storage: string, price: number) => {
    // Check if already in items
    const existing = items.findIndex(
      (item) => item.modelo === modelo && item.marca === marca && item.storage === storage
    );
    if (existing >= 0) {
      updateItemQuantity(existing, 1);
      return;
    }

    // Find phones for this model in the preview data
    const available = salePreview.availableModels.find(
      (m) => m.modelo === modelo && m.marca === marca
    );
    if (!available) return;

    // We don't have phoneIds/imeis for suggestions — Fritz will resolve them on confirm
    setItems((prev) => [
      ...prev,
      {
        modelo,
        marca,
        storage,
        lote: salePreview.lote,
        quantity: 1,
        pricePerUnit: price,
        total: price,
        phoneIds: [],
        imeis: [],
      },
    ]);
  };

  const handleFritzAdd = () => {
    if (!fritzInput.trim()) return;
    addToSale(fritzInput);
    setFritzInput('');
  };

  const handleConfirmSale = async () => {
    if (items.length === 0 || isExecuting) return;
    setIsExecuting(true);

    try {
      // Gather all phone IDs from items
      const allPhoneIds = items.flatMap((item) => item.phoneIds.slice(0, item.quantity));

      // For items without phoneIds (added via suggestions), Fritz will need to resolve them
      const itemsSummary = items
        .map((item) => `${item.quantity} ${item.marca} ${item.modelo} a ${fmt(item.pricePerUnit)}`)
        .join(', ');

      await sendMessage(
        `Confirmá la venta para ${salePreview.clientName}: ${itemsSummary}. Total: ${fmt(grandTotal)}. Pago: ${paymentMethod}. PhoneIDs: ${allPhoneIds.join(',')}`
      );

      handleClose();
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/50">
      <div
        ref={dialogRef}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden
          flex flex-col animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div
          className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-3
          flex items-center justify-between shrink-0"
        >
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-white" />
            <div>
              <div className="text-white text-sm font-bold">Fritz — Pre-Compra</div>
              <div className="text-emerald-200 text-[10px]">Revisá y agregá antes de confirmar</div>
            </div>
          </div>
          <button onClick={handleClose} className="text-white/70 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Client section */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">
                Cliente
              </div>
              <div className="text-sm font-bold text-gray-900 mt-0.5">{salePreview.clientName}</div>
              <div className="text-[11px] text-gray-500">
                Crédito: {fmt(salePreview.clientCredit)} · Deuda: {fmt(salePreview.clientDebt)}
              </div>
            </div>
          </div>

          {/* Items list */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide">
                Carrito ({totalPhones} items)
              </div>
              {items.length > 1 && (
                <button
                  onClick={() => setItems([])}
                  className="text-[10px] text-red-500 hover:text-red-700"
                >
                  Vaciar todo
                </button>
              )}
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={`${item.marca}-${item.modelo}-${index}`}
                  className="bg-gray-50 rounded-xl p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-gray-900">
                        {item.marca} {item.modelo} {item.storage}
                      </div>
                      <div className="text-[10px] text-gray-500">{item.lote}</div>
                    </div>
                    <div className="text-sm font-bold text-gray-900">{fmt(item.total)}</div>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateItemQuantity(index, -1)}
                        className="w-6 h-6 bg-gray-200 rounded-md flex items-center justify-center
                          hover:bg-gray-300 text-gray-700"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-sm font-bold text-gray-900 min-w-[20px] text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateItemQuantity(index, 1)}
                        className="w-6 h-6 bg-gray-200 rounded-md flex items-center justify-center
                          hover:bg-gray-300 text-gray-700"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <span className="text-[11px] text-gray-500">
                        ×{' '}
                        <input
                          type="number"
                          value={item.pricePerUnit}
                          onChange={(e) => updateItemPrice(index, parseFloat(e.target.value) || 0)}
                          className="w-16 px-1 py-0.5 text-[11px] border border-gray-200 rounded
                            text-center"
                        />{' '}
                        c/u
                      </span>
                    </div>
                    <button
                      onClick={() => removeItem(index)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add more section */}
            <div className="mt-3 border-2 border-dashed border-indigo-200 rounded-xl p-3 bg-indigo-50/50">
              <div className="text-[10px] text-indigo-700 font-semibold mb-2">
                + Agregar más teléfonos
              </div>

              {/* Search */}
              <div className="flex gap-1.5">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscá modelo..."
                    className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-[11px]
                      bg-white outline-none focus:border-indigo-400 pr-8"
                  />
                  <Search className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-300" />
                </div>
              </div>

              {/* Quick suggestions */}
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {filteredSuggestions.slice(0, 4).map((m) => (
                  <button
                    key={`${m.marca}-${m.modelo}-${m.storage}`}
                    onClick={() => handleAddSuggestion(m.modelo, m.marca, m.storage, m.price)}
                    className="px-2 py-1 bg-white border border-indigo-200 rounded-md
                      text-[9px] text-indigo-700 hover:bg-indigo-100 transition-colors"
                  >
                    {m.modelo} ({m.available} disp.)
                  </button>
                ))}
              </div>

              {/* Fritz inline input */}
              <div className="mt-2 bg-indigo-950 rounded-lg flex items-center gap-2 px-3 py-2">
                <Bot className="w-4 h-4 text-indigo-400 shrink-0" />
                <input
                  type="text"
                  value={fritzInput}
                  onChange={(e) => setFritzInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFritzAdd()}
                  placeholder='Decile a Fritz: "agregá 3 A36 a 220"'
                  className="flex-1 bg-transparent text-indigo-200 text-[11px] outline-none
                    placeholder:text-indigo-400/50"
                />
                <button
                  onClick={handleFritzAdd}
                  disabled={!fritzInput.trim()}
                  className="w-6 h-6 bg-indigo-700 rounded-md flex items-center justify-center
                    text-white disabled:opacity-30"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Totals */}
          <div className="px-4 py-3 bg-emerald-50">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between mb-1">
                <span className="text-[11px] text-gray-500">
                  {item.quantity} {item.modelo} × {fmt(item.pricePerUnit)}
                </span>
                <span className="text-[11px] text-gray-700">{fmt(item.total)}</span>
              </div>
            ))}
            <div className="flex justify-between pt-2 mt-2 border-t-2 border-emerald-200">
              <span className="text-lg font-bold text-emerald-800">Total</span>
              <span className="text-lg font-bold text-emerald-800">{fmt(grandTotal)}</span>
            </div>
            <div className="text-[10px] text-emerald-600 mt-0.5">
              {totalPhones} teléfono{totalPhones !== 1 ? 's' : ''} · {items.length} modelo
              {items.length !== 1 ? 's' : ''}
            </div>
          </div>

          {/* Payment method */}
          <div className="px-4 py-3 border-t border-gray-100">
            <div className="text-[10px] text-gray-500 uppercase font-semibold tracking-wide mb-2">
              Pago
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                    paymentMethod === method.id
                      ? 'bg-blue-100 border-2 border-blue-500 text-blue-700'
                      : 'bg-gray-50 border border-gray-200 text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {method.icon} {method.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 flex gap-2 border-t border-gray-100 shrink-0">
          <button
            onClick={handleClose}
            disabled={isExecuting}
            className="flex-1 py-3 bg-gray-100 rounded-xl text-sm font-semibold text-gray-600
              hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirmSale}
            disabled={items.length === 0 || isExecuting || isLoading}
            className="flex-[2] py-3 bg-gradient-to-r from-emerald-600 to-emerald-700
              rounded-xl text-sm font-bold text-white shadow-md
              hover:from-emerald-500 hover:to-emerald-600 transition-all
              disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExecuting ? 'Procesando...' : `✓ Confirmar Venta — ${fmt(grandTotal)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
