import { useSearchParams, Link } from 'react-router-dom';
import { XCircle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function CheckoutCancelPage() {
  const [params] = useSearchParams();
  const orderId = params.get('order_id');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <XCircle className="w-8 h-8 text-red-500" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pago cancelado</h1>

        {orderId && (
          <p className="text-xs text-gray-400 font-mono bg-gray-50 rounded-lg px-3 py-1.5 inline-block mb-3">
            Orden #{orderId.slice(0, 8).toUpperCase()}
          </p>
        )}

        <p className="text-gray-500 mb-7">
          No se realizó ningún cargo. Tu reserva sigue activa mientras no haya
          expirado. Puedes volver al catálogo y elegir otro método de pago.
        </p>

        {/* CTAs */}
        <div className="space-y-3">
          {orderId && (
            <Link
              to={`/catalogo`}
              className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Intentar de nuevo
            </Link>
          )}
          <Link
            to="/catalogo"
            className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al catálogo
          </Link>
        </div>
      </div>
    </div>
  );
}
