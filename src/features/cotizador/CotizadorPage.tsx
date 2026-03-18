import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Trash2 } from 'lucide-react';
import { useCotizador } from './hooks/useCotizador';
import CotizadorSearch from './components/CotizadorSearch';
import CotizadorCart from './components/CotizadorCart';
import CotizadorAuditLog from './components/CotizadorAuditLog';

export default function CotizadorPage() {
  const clear = useCotizador((s) => s.clear);
  const itemCount = useCotizador((s) => s.items.length);
  const removedCount = useCotizador((s) => s.removed.length);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClear = () => {
    if (itemCount === 0 && removedCount === 0) return;
    setShowConfirm(true);
  };

  const confirmClear = () => {
    clear();
    setShowConfirm(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center gap-3 px-4 py-3">
          <Link
            to="/dashboard"
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors"
            aria-label="Volver al panel"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>

          <div className="flex items-center gap-2 flex-1">
            <ShoppingBag className="w-5 h-5 text-cyan-600" />
            <h1 className="text-lg font-bold text-gray-900">Cotizador</h1>
            {itemCount > 0 && (
              <span className="bg-cyan-100 text-cyan-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {itemCount}
              </span>
            )}
          </div>

          {/* Clear button */}
          <button
            onClick={handleClear}
            disabled={itemCount === 0 && removedCount === 0}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-50 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Limpiar cotización"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-4">
        <CotizadorSearch />
        <CotizadorCart />
        <CotizadorAuditLog />
      </div>

      {/* Confirm clear dialog */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setShowConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-2">¿Limpiar cotización?</h2>
            <p className="text-sm text-gray-500 mb-5">
              Se eliminarán todos los equipos y el historial de removidos. Esta acción no se puede
              deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmClear}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
              >
                Limpiar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
