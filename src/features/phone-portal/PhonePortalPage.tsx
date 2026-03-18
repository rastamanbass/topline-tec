import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Smartphone,
  Package,
  ShieldOff,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Printer,
} from 'lucide-react';
import { usePhoneByImei } from './hooks/usePhoneByImei';
import StatusBadge from '../inventory/components/StatusBadge';
import type { PhoneStatus, StatusChange } from '../../types';

// ── Helpers ─────────────────────────────────────────────────────────────────

function getTimelineStep(status: PhoneStatus): number {
  if (status === 'En Bodega (USA)') return 0;
  if (status === 'En Tránsito (a El Salvador)') return 1;
  if (
    status === 'En Stock (Disponible para Venta)' ||
    status === 'Apartado' ||
    status === 'Enviado a Taller (Garantía)' ||
    status === 'Enviado a Taller (Externo)' ||
    status === 'En Taller (Recibido)' ||
    status === 'Enviado a Gerencia (Pendiente)' ||
    status === 'Enviado a Gerencia' ||
    status === 'Recibido de Taller (OK)' ||
    status === 'Reingreso (Tomado como parte de pago)'
  )
    return 2;
  if (
    status === 'Vendido' ||
    status === 'Pagado' ||
    status === 'Entregado al Cliente' ||
    status === 'Vendido (Pendiente de Entrega)'
  )
    return 3;
  return 2; // Default for other statuses
}

function getTimelineDotColor(status: PhoneStatus): string {
  if (status === 'En Stock (Disponible para Venta)') return 'bg-emerald-500';
  if (
    status === 'Vendido' ||
    status === 'Pagado' ||
    status === 'Entregado al Cliente' ||
    status === 'Vendido (Pendiente de Entrega)'
  )
    return 'bg-blue-500';
  if (status === 'Apartado') return 'bg-amber-500';
  if (
    status === 'Enviado a Taller (Garantía)' ||
    status === 'Enviado a Taller (Externo)' ||
    status === 'En Taller (Recibido)' ||
    status === 'Recibido de Taller (OK)'
  )
    return 'bg-orange-500';
  if (status === 'En Tránsito (a El Salvador)' || status === 'En Bodega (USA)')
    return 'bg-indigo-500';
  if (status === 'De Baja') return 'bg-gray-400';
  return 'bg-gray-400';
}

function parseHistoryDate(date: unknown): Date {
  if (!date) return new Date();
  if (date instanceof Date) return date;
  if (typeof date === 'string') return new Date(date);
  if (typeof (date as { toDate?: () => Date }).toDate === 'function')
    return (date as { toDate: () => Date }).toDate();
  return new Date();
}

const statusColors: Record<PhoneStatus, string> = {
  'En Bodega (USA)': 'bg-slate-100 text-slate-700',
  'En Tránsito (a El Salvador)': 'bg-blue-100 text-blue-700',
  'En Stock (Disponible para Venta)': 'bg-green-100 text-green-700',
  Apartado: 'bg-yellow-100 text-yellow-700',
  Pagado: 'bg-emerald-100 text-emerald-700',
  'Vendido (Pendiente de Entrega)': 'bg-purple-100 text-purple-700',
  Vendido: 'bg-purple-200 text-purple-800',
  'Enviado a Taller (Garantía)': 'bg-orange-100 text-orange-700',
  'Enviado a Taller (Externo)': 'bg-orange-200 text-orange-800',
  'En Taller (Recibido)': 'bg-amber-100 text-amber-700',
  'Enviado a Gerencia (Pendiente)': 'bg-cyan-100 text-cyan-700',
  'Enviado a Gerencia': 'bg-cyan-200 text-cyan-800',
  'Recibido de Taller (OK)': 'bg-teal-100 text-teal-700',
  'Entregado al Cliente': 'bg-indigo-100 text-indigo-700',
  'Reingreso (Tomado como parte de pago)': 'bg-violet-100 text-violet-700',
  'De Baja': 'bg-red-100 text-red-700',
};

// ── Timeline ─────────────────────────────────────────────────────────────────

const TIMELINE_STEPS = [
  { label: 'Bodega USA', icon: Package },
  { label: 'En Tránsito', icon: Truck },
  { label: 'En Stock', icon: Smartphone },
  { label: 'Vendido', icon: CheckCircle2 },
];

// ── Main Component ────────────────────────────────────────────────────────────

export default function PhonePortalPage() {
  const { imei = '' } = useParams<{ imei: string }>();
  const { data: phone, isLoading } = usePhoneByImei(imei);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <StickyHeader />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600 mx-auto mb-3" />
            <p className="text-sm text-gray-500">Buscando teléfono...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Not Found ─────────────────────────────────────────────────────────────
  if (!phone) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <StickyHeader />
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <AlertTriangle className="w-14 h-14 text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Teléfono no encontrado</h2>
            <p className="text-sm text-gray-500 mb-6">
              No se encontró ningún teléfono con IMEI{' '}
              <span className="font-mono font-semibold text-gray-700">{imei}</span> en el sistema.
            </p>
            <Link
              to="/inventory"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Ir al inventario
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Dates ─────────────────────────────────────────────────────────────────
  const fechaIngreso =
    typeof phone.fechaIngreso === 'string'
      ? new Date(phone.fechaIngreso)
      : ((phone.fechaIngreso as { toDate?: () => Date } | undefined)?.toDate?.() ?? new Date());

  const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('es-SV', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);

  const formatHistoryDate = (date: unknown) =>
    new Intl.DateTimeFormat('es-SV', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(parseHistoryDate(date));

  // ── Timeline step ─────────────────────────────────────────────────────────
  const currentStep = getTimelineStep(phone.estado);

  // ── Status History ────────────────────────────────────────────────────────
  const sortedHistory = phone.statusHistory
    ? [...phone.statusHistory].sort(
        (a: StatusChange, b: StatusChange) =>
          parseHistoryDate(b.date).getTime() - parseHistoryDate(a.date).getTime()
      )
    : [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-10">
      <StickyHeader
        imei={phone.imei}
        onPrint={() => window.open(`/labels/single/${phone.imei}`, '_blank')}
      />

      <main className="max-w-2xl mx-auto w-full px-4 pt-6 space-y-5">
        {/* Seized banner */}
        {phone.seized && (
          <div className="bg-red-100 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <ShieldOff className="w-5 h-5 text-red-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-800">INHABILITADO</p>
              <p className="text-xs text-red-700">
                {phone.seizedReason}
                {phone.seizedDate ? ` — ${phone.seizedDate}` : ''}
              </p>
            </div>
          </div>
        )}

        {/* Main info card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
          {/* Marca + Modelo */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {phone.marca} {phone.modelo}
              </h1>
              {phone.storage && <p className="text-sm text-gray-500 mt-0.5">{phone.storage}</p>}
            </div>
            <StatusBadge status={phone.estado} />
          </div>

          {/* IMEI display */}
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide font-medium">IMEI</p>
            <p className="font-mono text-2xl tracking-widest text-gray-900">{phone.imei}</p>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-4 pt-1">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">Lote</p>
              <p className="text-sm font-medium text-gray-900">{phone.lote}</p>
            </div>

            {phone.condition && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">
                  Condición
                </p>
                <p className="text-sm font-medium text-gray-900">{phone.condition}</p>
              </div>
            )}

            {phone.supplierCode && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">
                  Código proveedor
                </p>
                <p className="text-sm font-medium text-gray-900">{phone.supplierCode}</p>
              </div>
            )}

            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-1">
                Fecha ingreso
              </p>
              <p className="text-sm font-medium text-gray-900">{formatDate(fechaIngreso)}</p>
            </div>
          </div>
        </div>

        {/* Timeline progress */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Progreso del teléfono</h2>
          <div className="flex items-center gap-0">
            {TIMELINE_STEPS.map((step, i) => {
              const Icon = step.icon;
              const isDone = i < currentStep;
              const isCurrent = i === currentStep;
              const isLast = i === TIMELINE_STEPS.length - 1;
              return (
                <div key={step.label} className="flex items-center flex-1 last:flex-none">
                  {/* Step circle */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                        isDone
                          ? 'bg-primary-600 text-white'
                          : isCurrent
                            ? 'bg-primary-100 text-primary-600 ring-2 ring-primary-400'
                            : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-xs mt-1.5 font-medium text-center leading-tight ${
                        isDone || isCurrent ? 'text-primary-700' : 'text-gray-400'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>

                  {/* Connector bar */}
                  {!isLast && (
                    <div
                      className={`flex-1 h-1 mx-1 rounded-full transition-colors ${
                        i < currentStep ? 'bg-primary-400' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Status history */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">
            Historial de movimientos
            {sortedHistory.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({sortedHistory.length} {sortedHistory.length === 1 ? 'entrada' : 'entradas'})
              </span>
            )}
          </h2>

          {sortedHistory.length === 0 ? (
            <p className="text-sm text-gray-400 italic">Sin historial de movimientos registrado.</p>
          ) : (
            <div className="relative pl-6 space-y-0">
              {/* Vertical line */}
              <div className="absolute left-2 top-2 bottom-2 w-px bg-gray-200" />

              {sortedHistory.map((change: StatusChange, index: number) => {
                const dotColor = getTimelineDotColor(change.newStatus);
                const statusClass = statusColors[change.newStatus] ?? 'bg-gray-100 text-gray-700';
                return (
                  <div key={index} className="relative pb-4 last:pb-0">
                    {/* Dot */}
                    <div
                      className={`absolute -left-4 top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm ${dotColor}`}
                    />

                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <span
                          className={`inline-flex items-center rounded-full font-medium text-xs px-2 py-0.5 ${statusClass}`}
                        >
                          {change.newStatus}
                        </span>
                        <p className="text-xs text-gray-400 whitespace-nowrap">
                          {formatHistoryDate(change.date)}
                        </p>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        <p
                          className="text-xs text-gray-500 truncate max-w-[200px]"
                          title={change.user}
                        >
                          {change.user}
                        </p>
                        {change.details && (
                          <p className="text-xs text-gray-600 italic truncate">{change.details}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Sticky Header ─────────────────────────────────────────────────────────────

function StickyHeader({ onPrint }: { onPrint?: () => void }) {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/inventory"
            className="text-gray-500 hover:text-gray-800 transition-colors"
            aria-label="Volver al inventario"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-base font-semibold text-gray-900">Detalle de Teléfono</h1>
        </div>

        {onPrint && (
          <button
            onClick={onPrint}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary-600 transition-colors"
            title="Imprimir etiqueta"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Etiqueta</span>
          </button>
        )}
      </div>
    </header>
  );
}
