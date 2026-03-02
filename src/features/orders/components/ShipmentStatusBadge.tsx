import type { ShipmentStatus } from '../../../types';

interface ShipmentStatusBadgeProps {
  status: ShipmentStatus;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<ShipmentStatus, { label: string; color: string }> = {
  preparando:      { label: 'Preparando',      color: 'bg-gray-100 text-gray-600' },
  en_bodega_usa:   { label: 'En bodega USA',   color: 'bg-blue-100 text-blue-700' },
  en_transito:     { label: 'En transito',     color: 'bg-amber-100 text-amber-700' },
  en_aduana:       { label: 'En aduana',       color: 'bg-orange-100 text-orange-700' },
  en_el_salvador:  { label: 'En El Salvador',  color: 'bg-teal-100 text-teal-700' },
  entregado:       { label: 'Entregado',       color: 'bg-emerald-100 text-emerald-700' },
};

export default function ShipmentStatusBadge({ status, size = 'md' }: ShipmentStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.preparando;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${cfg.color} ${sizeClasses}`}
    >
      {cfg.label}
      {status === 'entregado' && ' \u2713'}
    </span>
  );
}
