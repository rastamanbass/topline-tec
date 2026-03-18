import { useCotizador } from '../hooks/useCotizador';

export default function CotizadorAuditLog() {
  const removed = useCotizador((s) => s.removed);

  if (removed.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">
        Equipos removidos
      </p>
      <div className="bg-amber-50 border border-amber-100 rounded-2xl overflow-hidden">
        {removed.map((item, idx) => {
          const time = new Date(item.removedAt).toLocaleTimeString('es-SV', {
            hour: '2-digit',
            minute: '2-digit',
          });
          return (
            <div
              key={`${item.imei}-${item.removedAt}`}
              className={`px-4 py-3 flex items-center justify-between gap-4 ${
                idx < removed.length - 1 ? 'border-b border-amber-100' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-amber-900 truncate">
                  {item.marca} {item.modelo}
                  {item.storage && (
                    <span className="ml-1 text-sm font-normal text-amber-700">
                      · {item.storage}
                    </span>
                  )}
                </p>
                <p className="text-xs text-amber-600 mt-0.5 truncate">
                  Quitado por <span className="font-medium">{item.removedBy}</span> a las{' '}
                  <span className="font-medium">{time}</span>
                </p>
              </div>
              <p className="flex-shrink-0 text-sm font-semibold text-amber-800">
                ${item.precio.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
