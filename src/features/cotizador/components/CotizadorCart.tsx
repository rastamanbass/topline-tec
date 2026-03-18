import { Smartphone, X } from 'lucide-react';
import { useCotizador } from '../hooks/useCotizador';
import { useAuth } from '../../../context';

export default function CotizadorCart() {
  const items = useCotizador((s) => s.items);
  const removeItem = useCotizador((s) => s.removeItem);
  const getTotal = useCotizador((s) => s.getTotal);
  const { user } = useAuth();

  const handleRemove = (imei: string) => {
    const email = user?.email ?? 'desconocido';
    removeItem(imei, email);
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <Smartphone className="w-14 h-14 mb-4 text-gray-300" />
        <p className="text-base font-medium">Escanea un IMEI para empezar</p>
        <p className="text-sm text-gray-400 mt-1">Los equipos aparecerán aquí</p>
      </div>
    );
  }

  const total = getTotal();

  return (
    <div className="flex flex-col gap-2">
      {/* Items list */}
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.imei}
            className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm"
          >
            {/* Phone icon */}
            <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-gray-500" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 truncate">
                {item.marca} {item.modelo}
                {item.storage && (
                  <span className="ml-1 text-sm font-normal text-gray-500">· {item.storage}</span>
                )}
              </p>
              <p className="text-lg font-mono tracking-widest text-gray-500 mt-0.5 truncate">
                {item.imei}
              </p>
            </div>

            {/* Price */}
            <div className="flex-shrink-0 text-right">
              <p className="text-xl font-bold text-gray-900">
                ${item.precio.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>

            {/* Remove button */}
            <button
              onClick={() => handleRemove(item.imei)}
              aria-label={`Quitar ${item.marca} ${item.modelo}`}
              className="flex-shrink-0 w-10 h-10 bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-600 rounded-xl flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

      {/* Sticky total */}
      <div className="sticky bottom-20 mt-2 bg-gray-900 text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-xl">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Total cotización
          </p>
          <p className="text-sm text-gray-400">
            {items.length} {items.length === 1 ? 'equipo' : 'equipos'}
          </p>
        </div>
        <p className="text-3xl font-black text-white">
          ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}
