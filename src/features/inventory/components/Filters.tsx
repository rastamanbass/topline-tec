import { Filter } from 'lucide-react';
import { useInventoryStore } from '../stores/inventoryStore';
import type { PhoneStatus } from '../../../types';

const allStatuses: PhoneStatus[] = [
  'En Bodega (USA)',
  'En Tránsito (a El Salvador)',
  'En Stock (Disponible para Venta)',
  'Apartado',
  'Pagado',
  'Vendido (Pendiente de Entrega)',
  'Vendido',
  'Enviado a Taller (Garantía)',
  'Enviado a Taller (Externo)',
  'En Taller (Recibido)',
  'Enviado a Gerencia (Pendiente)',
  'Enviado a Gerencia',
  'Recibido de Taller (OK)',
  'Entregado al Cliente',
  'Reingreso (Tomado como parte de pago)',
  'De Baja',
];

export default function Filters() {
  const { selectedLot, selectedStatus, setSelectedLot, setSelectedStatus, clearFilters } =
    useInventoryStore();

  const hasActiveFilters = selectedLot || selectedStatus;

  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Status Filter */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Filter className="h-5 w-5 text-gray-400" />
        </div>
        <select
          value={selectedStatus || ''}
          onChange={(e) => setSelectedStatus((e.target.value as PhoneStatus) || null)}
          className="input-field pl-10 pr-8 appearance-none cursor-pointer"
        >
          <option value="">Todos los estados</option>
          {allStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* Lot Filter */}
      <div>
        <input
          type="text"
          value={selectedLot || ''}
          onChange={(e) => setSelectedLot(e.target.value || null)}
          className="input-field"
          placeholder="Filtrar por lote..."
        />
      </div>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button onClick={clearFilters} className="btn-secondary whitespace-nowrap">
          Limpiar filtros
        </button>
      )}
    </div>
  );
}
