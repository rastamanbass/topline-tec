import { useState, useMemo } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useSalesStore } from '../../sales/stores/salesStore';
import { phoneLabel, normalizeDisplayBrand } from '../../../lib/phoneUtils';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { X, Minus, Plus, ShoppingCart, Search, Package, Loader2, ChevronRight } from 'lucide-react';
import type { Phone, PurchaseItem } from '../../../types';

interface ModelGroup {
  key: string;
  marca: string;
  modelo: string;
  storage: string;
  count: number;
  avgPrice: number;
  phones: Phone[];
}

interface LoteGroup {
  lote: string;
  count: number;
}

interface Props {
  onClose: () => void;
}

export default function BulkSaleDialog({ onClose }: Props) {
  const [searchText, setSearchText] = useState('');
  const [selectedLote, setSelectedLote] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<ModelGroup | null>(null);
  const [quantity, setQuantity] = useState(0);
  const [pricePerUnit, setPricePerUnit] = useState(0);
  const { addBulkToCart, openPaymentModal, cartItems } = useSalesStore();

  // Query all available phones
  const { data: phones = [], isLoading } = useQuery({
    queryKey: ['bulk-sale-phones'],
    queryFn: async () => {
      const q = query(
        collection(db, 'phones'),
        where('estado', '==', 'En Stock (Disponible para Venta)'),
        limit(500)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Phone);
    },
  });

  // Phones not already in cart
  const availablePhones = useMemo(() => {
    const cartImeis = new Set(cartItems.map((item) => item.imei));
    return phones.filter((phone) => !cartImeis.has(phone.imei));
  }, [phones, cartItems]);

  // Step 1: Group by lote
  const loteGroups = useMemo(() => {
    const groups = new Map<string, number>();
    availablePhones.forEach((phone) => {
      groups.set(phone.lote, (groups.get(phone.lote) || 0) + 1);
    });
    return Array.from(groups.entries())
      .map(([lote, count]): LoteGroup => ({ lote, count }))
      .sort((a, b) => b.count - a.count);
  }, [availablePhones]);

  // Step 2: Group by marca + modelo + storage (filtered by selected lote)
  const modelGroups = useMemo(() => {
    if (!selectedLote) return [];
    const groups = new Map<string, ModelGroup>();

    availablePhones
      .filter((phone) => phone.lote === selectedLote)
      .forEach((phone) => {
        const displayBrand = normalizeDisplayBrand(phone.marca);
        const key = `${displayBrand}|${phone.modelo}|${phone.storage || ''}`;
        const existing = groups.get(key);
        if (existing) {
          existing.count++;
          existing.phones.push(phone);
          existing.avgPrice = Math.round(
            existing.phones.reduce((sum, p) => sum + p.precioVenta, 0) / existing.phones.length
          );
        } else {
          groups.set(key, {
            key,
            marca: displayBrand,
            modelo: phone.modelo,
            storage: phone.storage || '',
            count: 1,
            avgPrice: phone.precioVenta,
            phones: [phone],
          });
        }
      });

    return Array.from(groups.values()).sort((a, b) => b.count - a.count);
  }, [availablePhones, selectedLote]);

  // Filter by search (works on both lotes and models depending on step)
  const filteredLotes = useMemo(() => {
    if (!searchText.trim()) return loteGroups;
    const q = searchText.toLowerCase();
    return loteGroups.filter((g) => g.lote.toLowerCase().includes(q));
  }, [loteGroups, searchText]);

  const filteredGroups = useMemo(() => {
    if (!searchText.trim()) return modelGroups;
    const q = searchText.toLowerCase();
    return modelGroups.filter(
      (g) =>
        g.modelo.toLowerCase().includes(q) ||
        g.marca.toLowerCase().includes(q) ||
        `${g.marca} ${g.modelo}`.toLowerCase().includes(q)
    );
  }, [modelGroups, searchText]);

  const handleSelectLote = (lote: string) => {
    setSelectedLote(lote);
    setSearchText('');
  };

  const handleSelectGroup = (group: ModelGroup) => {
    setSelectedGroup(group);
    setQuantity(group.count);
    setPricePerUnit(group.avgPrice);
  };

  const handleBackToLotes = () => {
    setSelectedLote(null);
    setSelectedGroup(null);
    setSearchText('');
  };

  const handleBackToModels = () => {
    setSelectedGroup(null);
  };

  const handleAddToCart = () => {
    if (!selectedGroup || quantity <= 0) return;

    const phonesToSell = selectedGroup.phones.slice(0, quantity);
    const items: PurchaseItem[] = phonesToSell.map((phone) => ({
      id: phone.id,
      phoneId: phone.id,
      imei: phone.imei,
      description: phoneLabel(selectedGroup.marca, selectedGroup.modelo),
      price: pricePerUnit,
      originalPrice: phone.precioVenta !== pricePerUnit ? phone.precioVenta : undefined,
      quantity: 1,
      type: 'phone' as const,
    }));

    addBulkToCart(items);
    toast.success(`${items.length} ${selectedGroup.modelo} agregados al carrito`);
    onClose();
    openPaymentModal();
  };

  // Determine current step
  const step = !selectedLote ? 1 : !selectedGroup ? 2 : 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-blue-50">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Venta en Lote</h2>
              {selectedLote && (
                <p className="text-xs text-blue-600 font-medium truncate max-w-[250px]">{selectedLote}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 1 && (
          /* Step 1: Select lote */
          <>
            <div className="px-5 py-3 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Buscar lote..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : filteredLotes.length === 0 ? (
                <p className="text-center text-gray-400 py-12 text-sm">No hay lotes con stock disponible</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filteredLotes.map((group) => (
                    <button
                      key={group.lote}
                      onClick={() => handleSelectLote(group.lote)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-blue-50 transition-colors text-left"
                    >
                      <Package className="w-5 h-5 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {group.lote}
                        </p>
                      </div>
                      <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full shrink-0">
                        {group.count} disp.
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {step === 2 && (
          /* Step 2: Select model within lote */
          <>
            <div className="px-5 py-3 border-b border-gray-100 space-y-2">
              <button
                onClick={handleBackToLotes}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                &larr; Cambiar lote
              </button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Buscar modelo..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredGroups.length === 0 ? (
                <p className="text-center text-gray-400 py-12 text-sm">No hay modelos disponibles en este lote</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filteredGroups.map((group) => (
                    <button
                      key={group.key}
                      onClick={() => handleSelectGroup(group)}
                      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-blue-50 transition-colors text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {group.marca} {group.modelo}
                        </p>
                        {group.storage && (
                          <p className="text-xs text-gray-500">{group.storage}</p>
                        )}
                      </div>
                      <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full shrink-0">
                        {group.count} disp.
                      </span>
                      <span className="text-sm font-bold text-gray-700 shrink-0">
                        ${group.avgPrice}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {step === 3 && selectedGroup && (
          /* Step 3: Quantity + Price */
          <>
            <div className="px-5 py-4 space-y-4">
              <button
                onClick={handleBackToModels}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                &larr; Cambiar modelo
              </button>

              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-lg font-bold text-gray-900">
                  {selectedGroup.marca} {selectedGroup.modelo}
                </p>
                {selectedGroup.storage && (
                  <p className="text-sm text-gray-500">{selectedGroup.storage}</p>
                )}
                <p className="text-sm text-blue-600 font-medium mt-1">
                  {selectedGroup.count} disponibles
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Lote: {selectedLote}
                </p>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cantidad a vender
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => {
                      const v = parseInt(e.target.value) || 0;
                      setQuantity(Math.min(selectedGroup.count, Math.max(0, v)));
                    }}
                    className="w-20 text-center text-2xl font-bold border border-gray-200 rounded-lg py-2"
                    min={1}
                    max={selectedGroup.count}
                  />
                  <button
                    onClick={() => setQuantity((q) => Math.min(selectedGroup.count, q + 1))}
                    className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setQuantity(selectedGroup.count)}
                    className="px-3 py-2 text-xs font-bold bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                  >
                    Todos ({selectedGroup.count})
                  </button>
                </div>
              </div>

              {/* Price per unit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Precio por unidad ($)
                </label>
                <input
                  type="number"
                  value={pricePerUnit}
                  onChange={(e) => setPricePerUnit(parseFloat(e.target.value) || 0)}
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-lg font-mono"
                  step="1"
                  min={0}
                />
                {pricePerUnit !== selectedGroup.avgPrice && (
                  <p className="text-xs text-amber-600 mt-1">
                    Precio original: ${selectedGroup.avgPrice} (diferencia: ${pricePerUnit - selectedGroup.avgPrice} por unidad)
                  </p>
                )}
              </div>

              {/* Total */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-sm text-green-700">Total</p>
                <p className="text-3xl font-bold text-green-800">
                  ${(quantity * pricePerUnit).toLocaleString()}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {quantity} × ${pricePerUnit}
                </p>
              </div>
            </div>

            {/* Action */}
            <div className="px-5 py-4 border-t border-gray-100">
              <button
                onClick={handleAddToCart}
                disabled={quantity <= 0 || pricePerUnit <= 0}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-bold text-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ShoppingCart className="w-5 h-5" />
                Agregar {quantity} al carrito
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
