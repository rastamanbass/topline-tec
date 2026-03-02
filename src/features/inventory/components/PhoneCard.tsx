import type { Phone } from '../../../types';
import { ShoppingCart, Eye, Star } from 'lucide-react';
import { useSalesStore } from '../../sales/stores/salesStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { phoneLabel } from '../../../lib/phoneUtils';

const statusBorderColor: Record<string, string> = {
  'En Stock (Disponible para Venta)': 'border-l-emerald-500',
  'Apartado': 'border-l-amber-500',
  'En Taller (Recibido)': 'border-l-red-500',
  'Enviado a Taller (Externo)': 'border-l-red-300',
  'Enviado a Taller (Garantía)': 'border-l-red-300',
  'En Tránsito (a El Salvador)': 'border-l-yellow-500',
  'En Bodega (USA)': 'border-l-blue-500',
  'Vendido': 'border-l-gray-300',
  'Pagado': 'border-l-gray-300',
};

interface PhoneCardProps {
  phone: Phone;
  isHighEnd?: boolean;
  isClientView?: boolean;
}

// Moved outside component to satisfy react-hooks/static-components rule
function BrandIcon({ brand, hasSupplierCode }: { brand: string | undefined; hasSupplierCode?: boolean }) {
  const b = (brand || '').toLowerCase();
  if (b.includes('apple') || b.includes('iphone'))
    return <span className="font-bold font-sans tracking-tight text-slate-900"> iPhone</span>;
  if (b.includes('samsung'))
    return (
      <span className="font-bold tracking-widest uppercase text-[10px] text-blue-900">SAMSUNG</span>
    );
  if (b.includes('xiaomi'))
    return (
      <span className="font-bold tracking-tight uppercase text-[10px] text-orange-500">mi</span>
    );
  if (hasSupplierCode) return null;
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{brand}</span>
  );
}

export default function PhoneCard({
  phone,
  isHighEnd = false,
  isClientView = false,
}: PhoneCardProps) {
  const { addToCart, openPaymentModal } = useSalesStore();
  const { openModal, selectedPhoneIds, toggleSelection } = useInventoryStore();
  const isSelected = selectedPhoneIds.has(phone.id);

  const handleSell = (e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart({
      id: phone.id,
      phoneId: phone.id,
      imei: phone.imei,
      description: phoneLabel(phone.marca, phone.modelo),
      price: phone.precioVenta,
      quantity: 1,
      type: 'phone',
    });
    openPaymentModal();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const isAvailable = phone.estado === 'En Stock (Disponible para Venta)';
  const borderColor = statusBorderColor[phone.estado] || 'border-l-gray-200';

  // POS stock lock badge
  const now = Date.now();
  const isPOSLocked =
    phone.reservation != null &&
    phone.reservation.reservedBy === 'POS_SALE' &&
    phone.reservation.expiresAt > now;

  const isCartDisabled = !isAvailable || isPOSLocked;

  return (
    <div
      className={`group relative bg-white rounded-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden border border-l-4 ${borderColor} ${
        isSelected
          ? 'ring-2 ring-primary-500 border-primary-500 bg-primary-50/50'
          : 'border-gray-100'
      }`}
    >
      {/* Status Indicator Bar */}
      <div className={`h-1 w-full ${isAvailable ? 'bg-emerald-500' : 'bg-gray-200'}`} />

      {/* Selection Checkbox */}
      <div
        className={`absolute top-3 left-3 z-20 transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-40 group-hover:opacity-100'}`}
      >
        <input
          type="checkbox"
          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 shadow-sm cursor-pointer"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            toggleSelection(phone.id);
          }}
        />
      </div>

      {/* Premium Badge */}
      {isHighEnd && !isPOSLocked && (
        <div className="absolute top-3 right-3 z-10">
          <div className="bg-slate-900 text-white text-[9px] uppercase font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 border border-slate-800">
            <Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />
            PRO
          </div>
        </div>
      )}

      {/* POS Lock Badge */}
      {isPOSLocked && (
        <div className="absolute top-3 right-3 z-10">
          <div className="bg-orange-500 text-white text-[9px] uppercase font-bold px-2 py-0.5 rounded-full shadow-md">
            En proceso...
          </div>
        </div>
      )}

      <div className="p-4 pt-5">
        {/* Brand Header */}
        <div className="mb-1 opacity-80">
          <BrandIcon brand={phone.marca} hasSupplierCode={!!phone.supplierCode} />
        </div>

        {/* Model Name */}
        <h3
          className="font-bold text-gray-900 text-base leading-tight mb-3 truncate"
          title={phone.modelo}
        >
          {phone.modelo}
        </h3>

        {/* Price & Action Row */}
        <div className="flex items-end justify-between border-t border-gray-100 pt-3 mt-2">
          <div>
            <p className="text-[10px] text-gray-400 uppercase font-medium mb-0.5">Precio</p>
            {phone.precioVenta === 0 || phone.precioVenta == null ? (
              <p className="text-sm font-medium text-orange-500">Sin precio</p>
            ) : (
              <p className="text-lg font-bold text-primary-600 tracking-tight">
                {formatCurrency(phone.precioVenta)}
              </p>
            )}
          </div>

          {!isClientView && (
            <div className="flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  openModal('view', phone);
                }}
                className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={handleSell}
                disabled={isCartDisabled}
                title={isPOSLocked ? 'Reservado en proceso de venta' : undefined}
                className={`p-2 rounded-lg transition-colors shadow-sm ${
                  !isCartDisabled
                    ? 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-primary-500/30'
                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                }`}
              >
                <ShoppingCart className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Info Grid (Hover reveals full details) */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-gray-500 bg-gray-50 rounded-lg p-2 border border-gray-100">
          <div className="flex justify-between">
            <span className="opacity-70">IMEI</span>
            <span className="font-mono text-gray-700" title={`IMEI completo: ${phone.imei}`}>{phone.imei.slice(-4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="opacity-70">Lote</span>
            <span className="font-medium text-gray-700">{phone.lote || '-'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
