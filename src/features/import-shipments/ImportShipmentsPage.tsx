import { useState } from 'react';
import { ArrowLeft, Plus, Truck, PackageCheck, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useImportShipments } from './hooks/useImportShipments';
import CreateShipmentModal from './components/CreateShipmentModal';
import ReceiveShipmentModal from './components/ReceiveShipmentModal';
import type { ImportShipment, ImportShipmentStatus } from '../../types';

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  ImportShipmentStatus,
  { label: string; icon: React.ReactNode; bg: string; text: string }
> = {
  preparando: {
    label: 'Preparando',
    icon: <Clock className="w-3.5 h-3.5" />,
    bg: 'bg-gray-100',
    text: 'text-gray-600',
  },
  en_transito: {
    label: 'En Tránsito',
    icon: <Truck className="w-3.5 h-3.5" />,
    bg: 'bg-blue-100',
    text: 'text-blue-700',
  },
  recibido: {
    label: 'Recibido',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
  },
};

function StatusBadge({ status }: { status: ImportShipmentStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ── Carrier label ─────────────────────────────────────────────────────────────
function carrierLabel(s: ImportShipment): string {
  if (s.carrier === 'Otro') return s.carrierCustomName || 'Otro';
  if (s.carrier === 'Persona') return `Persona: ${s.courierName || '—'}`;
  return s.carrier;
}

// ── Shipment card ─────────────────────────────────────────────────────────────
interface CardProps {
  shipment: ImportShipment;
  onReceive: (s: ImportShipment) => void;
}

function ShipmentCard({ shipment: s, onReceive }: CardProps) {
  const isTransit = s.status === 'en_transito';

  const arrivalLabel = s.estimatedArrival
    ? new Date(s.estimatedArrival + 'T12:00:00').toLocaleDateString('es-SV', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  const createdLabel = fmtDate(s.createdAt);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-gray-900 truncate">{s.name}</p>
          <p className="text-sm text-gray-500 mt-0.5">Lote: {s.lote}</p>
        </div>
        <StatusBadge status={s.status} />
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-gray-400 mb-0.5">Teléfonos</p>
          <p className="font-bold text-gray-800">
            {s.status === 'recibido' && s.receivedCount != null
              ? `${s.receivedCount} / ${s.phoneIds.length}`
              : s.phoneIds.length}
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-gray-400 mb-0.5">Empresa</p>
          <p className="font-bold text-gray-800 truncate">{carrierLabel(s)}</p>
        </div>
        {s.trackingNumber && (
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-gray-400 mb-0.5">Guía</p>
            <p className="font-bold text-gray-800 font-mono truncate">{s.trackingNumber}</p>
          </div>
        )}
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-gray-400 mb-0.5">
            {s.status === 'recibido' ? 'Recibido' : arrivalLabel ? 'Llega est.' : 'Creado'}
          </p>
          <p className="font-bold text-gray-800">
            {s.status === 'recibido' && s.receivedAt
              ? fmtDate(s.receivedAt, { day: 'numeric', month: 'short' })
              : arrivalLabel || createdLabel}
          </p>
        </div>
      </div>

      {/* Notes */}
      {s.notes && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 italic">{s.notes}</p>
      )}

      {/* Actions */}
      {isTransit && (
        <button
          onClick={() => onReceive(s)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm transition-colors"
        >
          <PackageCheck className="w-4 h-4" />
          Recibir envío con escáner
        </button>
      )}
    </div>
  );
}

// ── Date helper ───────────────────────────────────────────────────────────────
function fmtDate(ts: unknown, opts?: Intl.DateTimeFormatOptions): string {
  if (!ts) return '—';
  let ms = 0;
  if (typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
    ms = (ts as { toMillis: () => number }).toMillis();
  } else if (typeof ts === 'number') {
    ms = ts;
  } else {
    return '—';
  }
  return new Date(ms).toLocaleDateString('es-SV', opts ?? { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ImportShipmentsPage() {
  const { data: shipments = [], isLoading } = useImportShipments();
  const [showCreate, setShowCreate] = useState(false);
  const [receiving, setReceiving] = useState<ImportShipment | null>(null);

  const inTransit = shipments.filter((s) => s.status === 'en_transito');
  const others = shipments.filter((s) => s.status !== 'en_transito');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link to="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2 flex-1">
            <Truck className="w-5 h-5 text-indigo-600" />
            <h1 className="text-lg font-bold text-gray-900">Envíos USA → El Salvador</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Crear envío
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : shipments.length === 0 ? (
          <div className="text-center py-20">
            <Truck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No hay envíos registrados</p>
            <p className="text-sm text-gray-400 mt-1">
              Crea un envío cuando Eduardo mande teléfonos de USA a El Salvador.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear primer envío
            </button>
          </div>
        ) : (
          <>
            {/* In transit */}
            {inTransit.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  En Tránsito · {inTransit.length}
                </h2>
                <div className="space-y-4">
                  {inTransit.map((s) => (
                    <ShipmentCard key={s.id} shipment={s} onReceive={setReceiving} />
                  ))}
                </div>
              </section>
            )}

            {/* Others (preparando + recibido) */}
            {others.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Historial · {others.length}
                </h2>
                <div className="space-y-4">
                  {others.map((s) => (
                    <ShipmentCard key={s.id} shipment={s} onReceive={setReceiving} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* Create modal */}
      {showCreate && <CreateShipmentModal onClose={() => setShowCreate(false)} />}

      {/* Receive modal (full-screen) */}
      {receiving && (
        <ReceiveShipmentModal
          shipment={receiving}
          onClose={() => setReceiving(null)}
        />
      )}
    </div>
  );
}
