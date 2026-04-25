import type { Phone } from '../../../types';
import { Star, CheckCircle2, Lock, Package } from 'lucide-react';
import { isInternalCode } from '../../../lib/phoneUtils';

interface PhoneGroup {
  key: string;
  marca: string;
  modelo: string;
  almacenamiento?: string;
  precio: number;
  count: number;
  phones: Phone[];
}

interface GroupedPhoneCardProps {
  group: PhoneGroup;
  sessionId: string;
  onToggle: (phoneId: string, isReservedByMe: boolean) => void;
  isProcessing: string | null;
}

export default function GroupedPhoneCard({
  group,
  sessionId,
  onToggle,
  isProcessing,
}: GroupedPhoneCardProps) {
  const isHighEnd = ['Ultra', 'Pro', 'Max', 'Fold', 'Flip'].some((k) => group.modelo.includes(k));

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getBrandColor = (brand: string) => {
    const b = brand.toLowerCase();
    if (b.includes('apple') || b.includes('iphone'))
      return 'from-gray-100 to-gray-200 text-gray-800';
    if (b.includes('samsung')) return 'from-blue-50 to-blue-100 text-blue-800';
    if (b.includes('xiaomi') || b.includes('redmi') || b.includes('poco'))
      return 'from-orange-50 to-orange-100 text-orange-800';
    if (b.includes('motorola') || b.includes('moto'))
      return 'from-indigo-50 to-indigo-100 text-indigo-800';
    return 'from-gray-50 to-gray-100 text-gray-700';
  };

  // Find first phone available (not reserved by someone else)
  const availablePhone = group.phones.find(
    (p) => !p.reservation || p.reservation.reservedBy === sessionId
  );
  const myReservations = group.phones.filter((p) => p.reservation?.reservedBy === sessionId);
  const isReservedByMe = myReservations.length > 0;
  const allReservedByOther = group.phones.every(
    (p) => p.reservation && p.reservation.reservedBy !== sessionId
  );
  const brandStyle = getBrandColor(group.marca);
  const processing = isProcessing && group.phones.some((p) => p.id === isProcessing);

  const handleClick = () => {
    if (allReservedByOther || processing) return;
    if (isReservedByMe) {
      // Remove reservation from first reserved phone
      const reserved = group.phones.find((p) => p.reservation?.reservedBy === sessionId);
      if (reserved) onToggle(reserved.id, true);
    } else if (availablePhone) {
      onToggle(availablePhone.id, false);
    }
  };

  const disponibles = group.phones.filter(
    (p) => !p.reservation || p.reservation.reservedBy === sessionId
  ).length;

  return (
    <div
      onClick={handleClick}
      className={`
        relative rounded-2xl shadow-sm overflow-hidden flex flex-col transition-all duration-300 cursor-pointer border border-gray-100 group select-none
        ${isReservedByMe ? 'ring-2 ring-primary-500 shadow-lg scale-[1.02]' : ''}
        ${allReservedByOther ? 'opacity-70 grayscale cursor-not-allowed bg-gray-50' : 'hover:shadow-xl hover:-translate-y-1 hover:border-primary-200 bg-white'}
      `}
    >
      {isHighEnd && !allReservedByOther && (
        <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] uppercase font-bold px-3 py-1 rounded-bl-xl z-20 flex items-center gap-1 shadow-sm">
          <Star className="w-3 h-3 fill-current" />
          Premium
        </div>
      )}

      {/* Header */}
      <div
        className={`h-24 bg-gradient-to-br ${brandStyle} relative overflow-hidden p-4 flex flex-col justify-between transition-colors duration-500`}
      >
        <div className="flex justify-between items-start z-10 w-full">
          {!isInternalCode(group.marca) && (
            <span className="text-sm font-bold uppercase tracking-wider">{group.marca}</span>
          )}
          <div className="flex gap-1">
            {isReservedByMe && (
              <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> APARTADO
              </span>
            )}
            {allReservedByOther && (
              <span className="bg-gray-800 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                <Lock className="w-3 h-3" /> RESERVADO
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-grow relative bg-white">
        <div className="mb-4">
          <h3 className="text-xl font-black text-gray-900 leading-tight group-hover:text-primary-600 transition-colors">
            {group.modelo} {group.almacenamiento || ''}
          </h3>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {/* Stock count badge */}
            <span
              className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                disponibles > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
              }`}
            >
              <Package className="w-3 h-3" />
              {disponibles > 0 ? `${disponibles} disponibles` : 'Sin stock'}
            </span>
          </div>
        </div>

        <div className="mt-auto pt-2 flex items-end justify-between border-t border-gray-50">
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 font-medium mb-0.5">Precio</span>
            <span
              className={`text-2xl font-bold ${allReservedByOther ? 'text-gray-400' : 'text-gray-900'}`}
            >
              {group.precio > 0 ? (
                formatCurrency(group.precio)
              ) : (
                <span className="text-orange-500 text-base font-medium">Sin precio</span>
              )}
            </span>
          </div>

          <div
            className={`
            w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm
            ${
              isReservedByMe
                ? 'bg-green-500 text-white scale-110 shadow-green-200'
                : allReservedByOther
                  ? 'bg-gray-200 text-gray-400'
                  : 'bg-primary-50 text-primary-600 group-hover:bg-primary-600 group-hover:text-white'
            }
          `}
          >
            {isReservedByMe ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : allReservedByOther ? (
              <Lock className="w-5 h-5" />
            ) : (
              <div className="w-3 h-3 bg-current rounded-full group-hover:scale-150 transition-transform" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
