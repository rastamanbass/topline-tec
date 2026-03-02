import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, ShoppingBag, ArrowLeft } from 'lucide-react';

export default function CheckoutSuccessPage() {
  const [params] = useSearchParams();
  const orderId = params.get('order_id');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle className="w-8 h-8 text-emerald-600" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pago exitoso</h1>
        <p className="text-gray-500 mb-2">Tu pedido ha sido confirmado.</p>

        {/* Order ID badge */}
        {orderId && (
          <p className="text-xs text-gray-400 font-mono bg-gray-50 rounded-lg px-3 py-1.5 inline-block mb-5">
            Orden #{orderId.slice(0, 8).toUpperCase()}
          </p>
        )}

        <p className="text-sm text-gray-600 mb-7">
          Recibirás confirmación por WhatsApp. El equipo de Top Line Tec
          coordinará la entrega contigo a la brevedad.
        </p>

        {/* CTAs */}
        <div className="space-y-3">
          <Link
            to="/mis-pedidos"
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            Ver mis pedidos
          </Link>
          <Link
            to="/catalogo"
            className="w-full flex items-center justify-center gap-2 py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Seguir comprando
          </Link>
        </div>
      </div>
    </div>
  );
}
