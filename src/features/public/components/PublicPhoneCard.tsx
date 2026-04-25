import type { Phone } from '../../../types';
import { Star, CheckCircle2, Lock } from 'lucide-react';

interface PublicPhoneCardProps {
  phone: Phone;
  isReservedByMe: boolean;
  isReservedByOther: boolean;
  onToggle: () => void;
  isProcessing: boolean;
}

export default function PublicPhoneCard({
  phone,
  isReservedByMe,
  isReservedByOther,
  onToggle,
  isProcessing,
}: PublicPhoneCardProps) {
  const isHighEnd = ['Ultra', 'Pro', 'Max', 'Fold', 'Flip'].some((k) => phone.modelo.includes(k));

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
    if (b.includes('google') || b.includes('pixel')) return 'from-red-50 to-green-50 text-gray-800'; // Fun mix
    return 'from-gray-50 to-gray-100 text-gray-700';
  };

  const brandStyle = getBrandColor(phone.marca);

  return (
    <div
      onClick={() => !isReservedByOther && !isProcessing && onToggle()}
      className={`
                relative rounded-2xl shadow-sm overflow-hidden flex flex-col transition-all duration-300 cursor-pointer border border-gray-100 group select-none
                ${isReservedByMe ? 'ring-2 ring-primary-500 shadow-lg scale-[1.02]' : ''}
                ${isReservedByOther ? 'opacity-70 grayscale cursor-not-allowed bg-gray-50' : 'hover:shadow-xl hover:-translate-y-1 hover:border-primary-200 bg-white'}
            `}
    >
      {isHighEnd && !isReservedByOther && (
        <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] uppercase font-bold px-3 py-1 rounded-bl-xl z-20 flex items-center gap-1 shadow-sm">
          <Star className="w-3 h-3 fill-current" />
          Premium
        </div>
      )}

      {isReservedByMe && (
        <div className="absolute inset-0 z-20 pointer-events-none border-4 border-green-500 rounded-2xl animate-pulse-slow opacity-20"></div>
      )}

      {/* Clean Header */}
      <div
        className={`h-24 bg-gradient-to-br ${brandStyle} relative overflow-hidden p-4 flex flex-col justify-between transition-colors duration-500`}
      >
        {/* Status Badges on Top */}
        <div className="flex justify-between items-start z-10 w-full">
          <span className="text-sm font-bold uppercase tracking-wider">{phone.marca}</span>

          <div className="flex gap-1">
            {isReservedByMe && (
              <span className="bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1 animate-bounce-in">
                <CheckCircle2 className="w-3 h-3" /> APARTADO
              </span>
            )}
            {isReservedByOther && (
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
            {phone.modelo}
          </h3>
        </div>

        <div className="mt-auto pt-2 flex items-end justify-between border-t border-gray-50 mt-2">
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 font-medium mb-0.5">Precio</span>
            <span
              className={`text-2xl font-bold ${isReservedByOther ? 'text-gray-400' : 'text-gray-900'}`}
            >
              {formatCurrency(phone.precioVenta)}
            </span>
          </div>

          <div
            className={`
                        w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm
                        ${
                          isReservedByMe
                            ? 'bg-green-500 text-white scale-110 shadow-green-200'
                            : isReservedByOther
                              ? 'bg-gray-200 text-gray-400'
                              : 'bg-primary-50 text-primary-600 group-hover:bg-primary-600 group-hover:text-white'
                        }
                    `}
          >
            {isReservedByMe ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : isReservedByOther ? (
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
