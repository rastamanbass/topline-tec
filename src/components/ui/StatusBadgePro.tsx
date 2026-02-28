import { motion } from 'framer-motion';
import type { PhoneStatus } from '../../types';

interface StatusBadgeProProps {
  status: PhoneStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  'En Stock (Disponible para Venta)': { color: 'bg-emerald-500', label: 'Disponible' },
  Vendido: { color: 'bg-blue-600', label: 'Vendido' },
  Apartado: { color: 'bg-amber-500', label: 'Apartado' },
  'En Taller (Recibido)': { color: 'bg-pink-500', label: 'En Taller' },
  'Enviado a Gerencia': { color: 'bg-indigo-600', label: 'Gerencia' },
  'En Bodega (USA)': { color: 'bg-slate-500', label: 'Bodega USA' },
  // Defaults matching your existing logic but simplified visual
};

export default function StatusBadgePro({ status, size = 'md' }: StatusBadgeProProps) {
  const config = STATUS_CONFIG[status] || { color: 'bg-gray-500', label: status };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <motion.span
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`
                relative inline-flex items-center justify-center font-semibold text-white rounded-full 
                shadow-sm backdrop-blur-sm ${config.color} ${sizeClasses[size]}
                overflow-hidden
            `}
    >
      {/* Glossy Effect */}
      <span className="absolute top-0 left-0 w-full h-[50%] bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />

      {/* Glow / Pulse for critical states */}
      {status === 'En Stock (Disponible para Venta)' && (
        <span className="absolute inset-0 rounded-full ring-2 ring-white/30 animate-pulse-slow" />
      )}

      <span className="relative z-10 truncate max-w-[150px]">{config.label}</span>
    </motion.span>
  );
}
