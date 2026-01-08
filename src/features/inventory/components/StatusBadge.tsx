import type { PhoneStatus } from '../../../types';

interface StatusBadgeProps {
  status: PhoneStatus;
  size?: 'sm' | 'md';
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

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${statusColors[status]} ${sizeClasses}`}
    >
      {status}
    </span>
  );
}
