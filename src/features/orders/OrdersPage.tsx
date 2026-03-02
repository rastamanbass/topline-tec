import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../../lib/firebase';
import app from '../../lib/firebase';
import {
  ShoppingBag,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  Package,
  ArrowLeft,
  Truck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useShipments } from './hooks/useShipments';
import ShipmentStatusBadge from './components/ShipmentStatusBadge';
import ShipmentModal from './components/ShipmentModal';
import type { PendingOrder, Shipment } from '../../types';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

const fmtDate = (ts: Timestamp | null | undefined): string => {
  if (!ts) return '—';
  try {
    return new Intl.DateTimeFormat('es-SV', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(ts.toDate());
  } catch {
    return '—';
  }
};

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_LABELS: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  reserved: { label: 'Reservado', color: 'bg-amber-100 text-amber-700', Icon: Clock },
  pending_payment: { label: 'Pago pendiente', color: 'bg-blue-100 text-blue-700', Icon: Clock },
  pending_transfer: {
    label: 'Esperando transferencia',
    color: 'bg-indigo-100 text-indigo-700',
    Icon: Clock,
  },
  paid: { label: 'Pagado', color: 'bg-emerald-100 text-emerald-700', Icon: CheckCircle },
  delivered: { label: 'Entregado', color: 'bg-gray-100 text-gray-600', Icon: Package },
  cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-400', Icon: XCircle },
  payment_failed: { label: 'Pago fallido', color: 'bg-red-100 text-red-400', Icon: XCircle },
};

const FILTER_TABS = [
  'all',
  'pending_transfer',
  'pending_payment',
  'paid',
  'delivered',
  'cancelled',
] as const;
type FilterTab = (typeof FILTER_TABS)[number];

// ── Order type ────────────────────────────────────────────────────────────────
interface OrderPhone {
  marca: string;
  modelo: string;
}

interface AdminOrder {
  id: string;
  status: string;
  total: number;
  phones: OrderPhone[];
  phoneIds: string[];
  clientId?: string;
  clientEmail?: string;
  clientAlias?: string;
  clientPhone?: string;
  paymentMethod?: string;
  createdAt: Timestamp;
  paidAt?: Timestamp;
  shipmentId?: string;
  notes?: string;
  whatsappLink?: string;
}

// ── Statuses that can have a shipment ────────────────────────────────────────
const SHIPPABLE_STATUSES = new Set(['paid', 'pending_transfer', 'delivered']);

// ── Component ─────────────────────────────────────────────────────────────────
export default function OrdersPage() {
  const qc = useQueryClient();
  const fns = getFunctions(app, 'us-central1');

  const [statusFilter, setStatusFilter] = useState<FilterTab>('all');
  const [shipmentModal, setShipmentModal] = useState<{
    orderId: string;
    order: PendingOrder | null;
    existingShipment: Shipment | null;
  } | null>(null);

  const { data: orders = [], isLoading } = useQuery<AdminOrder[]>({
    queryKey: ['admin-orders', statusFilter],
    queryFn: async () => {
      const q =
        statusFilter === 'all'
          ? query(
              collection(db, 'pendingOrders'),
              orderBy('createdAt', 'desc'),
              limit(100)
            )
          : query(
              collection(db, 'pendingOrders'),
              where('status', '==', statusFilter),
              orderBy('createdAt', 'desc'),
              limit(100)
            );
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminOrder));
    },
  });

  // Fetch all shipments to build a lookup map by orderId
  const { data: shipments = [] } = useShipments();
  const shipmentByOrderId = React.useMemo(() => {
    const map = new Map<string, Shipment>();
    for (const s of shipments) {
      map.set(s.orderId, s);
    }
    return map;
  }, [shipments]);

  // Confirm transfer mutation
  const confirmTransfer = useMutation({
    mutationFn: async (orderId: string) => {
      const fn = httpsCallable<{ orderId: string }, { success: boolean }>(
        fns,
        'confirmTransferPayment'
      );
      await fn({ orderId });
    },
    onSuccess: () => {
      toast.success('Transferencia confirmada');
      qc.invalidateQueries({ queryKey: ['admin-orders'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Error al confirmar'),
  });

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const pendingTransferCount = orders.filter((o) => o.status === 'pending_transfer').length;
  const paidTodayCount = orders.filter((o) => {
    if (o.status !== 'paid' || !o.paidAt) return false;
    try {
      return o.paidAt.toDate().toDateString() === new Date().toDateString();
    } catch {
      return false;
    }
  }).length;
  const totalRevenue = orders
    .filter((o) => ['paid', 'delivered'].includes(o.status))
    .reduce((s, o) => s + (o.total || 0), 0);

  // In-transit KPI: shipments in intermediate statuses
  const inTransitCount = shipments.filter((s) =>
    ['en_transito', 'en_bodega_usa', 'en_aduana', 'en_el_salvador'].includes(s.status)
  ).length;

  // ── Open modal helper ─────────────────────────────────────────────────────
  const openShipmentModal = (order: AdminOrder) => {
    const existingShipment = shipmentByOrderId.get(order.id) ?? null;
    // Cast AdminOrder to PendingOrder-compatible shape for the modal
    const pendingOrder: PendingOrder = {
      id: order.id,
      sessionId: '',
      clientId: order.clientId,
      clientAlias: order.clientAlias,
      clientEmail: order.clientEmail,
      clientPhone: order.clientPhone,
      phoneIds: order.phoneIds ?? [],
      phones: order.phones?.map((p) => ({
        id: '',
        marca: p.marca,
        modelo: p.modelo,
        precio: 0,
        imei: '',
        condition: '',
      })) ?? [],
      subtotal: order.total,
      discountAmount: 0,
      total: order.total,
      status: order.status as PendingOrder['status'],
      createdAt: new Date(),
      reservedUntil: new Date(),
      notes: order.notes,
      whatsappLink: order.whatsappLink,
    };

    setShipmentModal({ orderId: order.id, order: pendingOrder, existingShipment });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 h-16">
            <Link
              to="/dashboard"
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <ShoppingBag className="w-6 h-6 text-indigo-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Ordenes Online</h1>
              <p className="text-sm text-gray-500">Pedidos del catalogo B2B</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1 text-indigo-600">
              <Clock className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Esperando transferencia
              </span>
            </div>
            <p className="text-3xl font-bold text-indigo-900">{pendingTransferCount}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1 text-emerald-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">Pagadas hoy</span>
            </div>
            <p className="text-3xl font-bold text-emerald-900">{paidTodayCount}</p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1 text-blue-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Ingresos (página actual)
              </span>
            </div>
            <p className="text-2xl font-bold text-blue-900">{fmt(totalRevenue)}</p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1 text-amber-600">
              <Truck className="w-4 h-4" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                En tránsito
              </span>
            </div>
            <p className="text-3xl font-bold text-amber-900">{inTransitCount}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {FILTER_TABS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
                statusFilter === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s === 'all' ? 'Todos' : (STATUS_LABELS[s]?.label ?? s)}
            </button>
          ))}
        </div>

        {/* Orders list */}
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-gray-50">
              {orders.map((order) => {
                const status = order.status;
                const cfg = STATUS_LABELS[status] ?? {
                  label: status,
                  color: 'bg-gray-100 text-gray-500',
                  Icon: Package,
                };
                const { Icon } = cfg;
                const shipment = shipmentByOrderId.get(order.id);
                const isShippable = SHIPPABLE_STATUSES.has(status);

                return (
                  <div
                    key={order.id}
                    className="flex items-center gap-4 px-6 py-4"
                  >
                    {/* Left: order info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 font-mono">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <span
                          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}
                        >
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                        {/* Shipment badge */}
                        {shipment && (
                          <ShipmentStatusBadge status={shipment.status} size="sm" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {order.phones?.map((p) => `${p.marca} ${p.modelo}`).join(' · ') ||
                          'Sin equipos'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {order.clientEmail || order.clientAlias || 'Cliente anónimo'} ·{' '}
                        {fmtDate(order.createdAt)}
                      </p>
                    </div>

                    {/* Right: total + actions */}
                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <p className="font-bold text-gray-900">{fmt(order.total)}</p>
                      <div className="flex items-center gap-2">
                        {status === 'pending_transfer' && (
                          <button
                            onClick={() => confirmTransfer.mutate(order.id)}
                            disabled={confirmTransfer.isPending}
                            className="text-xs px-3 py-1 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                          >
                            {confirmTransfer.isPending ? 'Confirmando...' : 'Confirmar pago'}
                          </button>
                        )}
                        {/* Shipment button: only for shippable statuses */}
                        {isShippable && (
                          <button
                            onClick={() => openShipmentModal(order)}
                            title={shipment ? 'Ver / editar envío' : 'Crear envío'}
                            className={`flex items-center gap-1 text-xs px-3 py-1 rounded-lg font-semibold transition-colors ${
                              shipment
                                ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                                : 'bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100'
                            }`}
                          >
                            <Truck className="w-3.5 h-3.5" />
                            {shipment ? 'Envío' : 'Crear envío'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Empty state */}
              {orders.length === 0 && (
                <div className="py-12 text-center text-gray-400">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No hay ordenes con este filtro</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Shipment Modal */}
      {shipmentModal && (
        <ShipmentModal
          orderId={shipmentModal.orderId}
          order={shipmentModal.order}
          existingShipment={shipmentModal.existingShipment}
          onClose={() => setShipmentModal(null)}
        />
      )}
    </div>
  );
}
