import { useQuery } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../context';
import { useOrderShipment } from '../../orders/hooks/useShipments';
import ShipmentStatusBadge from '../../orders/components/ShipmentStatusBadge';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  CheckCircle,
  Clock,
  XCircle,
  Package,
  ArrowLeft,
  Truck,
  MapPin,
  MessageCircle,
} from 'lucide-react';
import type { ShipmentStatus } from '../../../types';

// ── Constants ─────────────────────────────────────────────────────────────────
// Numero de WhatsApp de Top Line Tec (solo digitos, sin + ni espacios).
// Actualizar con el numero real cuando este confirmado.
const TOPLINE_WA_NUMBER = import.meta.env.VITE_TOPLINE_WA_NUMBER || "15551234567";

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; Icon: React.ElementType }
> = {
  reserved:         { label: 'Reservado',              color: 'bg-amber-100 text-amber-700',    Icon: Clock },
  pending_payment:  { label: 'Pago pendiente',          color: 'bg-blue-100 text-blue-700',     Icon: Clock },
  pending_transfer: { label: 'Esperando transferencia', color: 'bg-indigo-100 text-indigo-700', Icon: Clock },
  paid:             { label: 'Pagado',                  color: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle },
  delivered:        { label: 'Entregado',               color: 'bg-gray-100 text-gray-600',     Icon: Package },
  cancelled:        { label: 'Cancelado',               color: 'bg-red-100 text-red-500',       Icon: XCircle },
  payment_failed:   { label: 'Pago fallido',            color: 'bg-red-100 text-red-500',       Icon: XCircle },
};

const SHIPMENT_STEPS: ShipmentStatus[] = [
  'preparando', 'en_bodega_usa', 'en_transito', 'en_aduana', 'en_el_salvador', 'entregado',
];
const STEP_LABELS: Record<ShipmentStatus, string> = {
  preparando:     'Preparando',
  en_bodega_usa:  'Bodega USA',
  en_transito:    'En tránsito',
  en_aduana:      'Aduana',
  en_el_salvador: 'El Salvador',
  entregado:      'Entregado',
};

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const fmtDate = (ts: Timestamp | null | undefined): string => {
  if (!ts) return '—';
  try {
    return new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium', timeStyle: 'short' }).format(ts.toDate());
  } catch { return '—'; }
};

const fmtDateStr = (s?: string) => {
  if (!s) return null;
  try {
    return new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium' }).format(new Date(s + 'T12:00:00'));
  } catch { return s; }
};

// ── Order types ───────────────────────────────────────────────────────────────
interface OrderPhone { marca: string; modelo: string; storage?: string; precio: number; }
interface OrderDoc {
  id: string;
  status: string;
  total: number;
  phones: OrderPhone[];
  createdAt: Timestamp;
  paidAt?: Timestamp;
  invoiceUrl?: string;
}

// ── Shipment tracker sub-component ────────────────────────────────────────────
function ShipmentTracker({ orderId }: { orderId: string }) {
  const { data: shipment, isLoading } = useOrderShipment(orderId);

  if (isLoading) return null;

  if (!shipment) {
    return (
      <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-400">
        <Package className="w-4 h-4" />
        <span>Tu pedido está siendo preparado para envío</span>
      </div>
    );
  }

  const currentIdx = SHIPMENT_STEPS.indexOf(shipment.status);

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      {/* Carrier info */}
      <div className="flex items-center gap-2 mb-3">
        <Truck className="w-4 h-4 text-gray-400 shrink-0" />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="font-medium text-gray-700">
            {shipment.carrier === 'Persona'
              ? `Courier: ${shipment.courierName || 'Persona'}`
              : shipment.carrier === 'Otro'
              ? shipment.carrierCustomName || 'Carrier'
              : shipment.carrier}
          </span>
          {shipment.trackingNumber && (
            <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
              #{shipment.trackingNumber}
            </span>
          )}
          <ShipmentStatusBadge status={shipment.status} size="sm" />
          {shipment.estimatedArrival && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="w-3 h-3" />
              Estimado: {fmtDateStr(shipment.estimatedArrival)}
            </span>
          )}
        </div>
      </div>

      {/* Progress timeline */}
      <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
        {SHIPMENT_STEPS.map((step, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          return (
            <div key={step} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                    done    ? 'bg-emerald-500 text-white'
                    : active ? 'bg-primary-600 text-white ring-2 ring-primary-200'
                    : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {done ? '✓' : idx + 1}
                </div>
                <span className={`text-[10px] text-center leading-tight whitespace-nowrap ${
                  done ? 'text-emerald-600 font-medium'
                  : active ? 'text-primary-600 font-semibold'
                  : 'text-gray-400'
                }`}>
                  {STEP_LABELS[step]}
                </span>
              </div>
              {idx < SHIPMENT_STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-0.5 rounded ${done ? 'bg-emerald-400' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      {shipment.notes && (
        <p className="mt-2 text-xs text-gray-500 italic">{shipment.notes}</p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MyOrdersPage() {
  const { user } = useAuth();

  const { data: orders, isLoading } = useQuery<OrderDoc[]>({
    queryKey: ['my-orders', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return [];
      const q = query(
        collection(db, 'pendingOrders'),
        where('clientId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderDoc));
    },
    enabled: !!user?.uid,
  });

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-4">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-4">Debes iniciar sesión para ver tus pedidos.</p>
          <Link to="/login" className="btn-primary">Iniciar sesión</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/catalogo" className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Volver al catálogo">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <ShoppingBag className="w-5 h-5 text-primary-600" />
          <h1 className="text-xl font-bold text-gray-900">Mis Pedidos</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-36 bg-gray-200 rounded-2xl" />
            ))}
          </div>
        ) : !orders?.length ? (
          <div className="text-center py-16 flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">No tienes pedidos aún</p>
            <p className="text-gray-400 text-sm">Explora el catálogo y aparta los equipos que necesitas.</p>
            <Link to="/catalogo" className="btn-primary mt-2">Ver catálogo</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const status = order.status as keyof typeof STATUS_CONFIG;
              const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.cancelled;
              const { Icon } = cfg;
              const showTracking = ['paid', 'delivered'].includes(order.status);

              return (
                <div key={order.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm font-mono">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-400">{fmtDate(order.createdAt)}</p>
                    </div>
                    <span className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.color}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </div>

                  <div className="space-y-1 mb-3">
                    {order.phones?.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{p.marca} {p.modelo}{p.storage ? ` · ${p.storage}` : ''}</span>
                        <span className="font-medium text-gray-900">{fmt(p.precio)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-gray-50 pt-3">
                    <p className="text-sm font-bold text-gray-900">Total: {fmt(order.total)}</p>
                    <div className="flex gap-2 items-center">
                      {order.invoiceUrl && (
                        <a href={order.invoiceUrl} target="_blank" rel="noreferrer"
                          className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-semibold hover:bg-emerald-100 transition-colors">
                          Descargar factura
                        </a>
                      )}
                      {order.status === 'pending_transfer' && (
                        <a
                          href={`https://wa.me/${TOPLINE_WA_NUMBER}?text=${encodeURIComponent(
                            `Hola, adjunto comprobante de transferencia para el pedido #${order.id.slice(0, 8).toUpperCase()} por ${fmt(order.total)}.`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg font-semibold hover:bg-green-100 transition-colors"
                        >
                          <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                          Enviar comprobante · Pedido #{order.id.slice(0, 8).toUpperCase()}
                        </a>
                      )}
                    </div>
                  </div>

                  {showTracking && <ShipmentTracker orderId={order.id} />}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
