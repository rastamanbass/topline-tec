import { useState, useEffect, useRef } from 'react';
import { Filter, ChevronDown } from 'lucide-react';
import { useInventoryStore } from '../stores/inventoryStore';
import { useUniqueLots } from '../hooks/useUniqueLots';
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

  const [lotOpen, setLotOpen] = useState(false);
  const [lotSearch, setLotSearch] = useState('');
  const { data: lotOptions = [], isLoading: lotsLoading } = useUniqueLots();
  const lotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (lotRef.current && !lotRef.current.contains(e.target as Node)) {
        setLotOpen(false);
        setLotSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredLots = lotOptions.filter(l =>
    l.name.toLowerCase().includes(lotSearch.toLowerCase())
  );

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

      {/* Lot Filter — Dropdown / Combobox */}
      <div className="relative" ref={lotRef}>
        {/* Trigger button */}
        <button
          type="button"
          onClick={() => { setLotOpen(o => !o); setLotSearch(''); }}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm bg-white border border-gray-200
                     rounded-xl hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-300
                     transition-all text-left min-w-[200px]"
        >
          <span className={`flex-1 truncate ${selectedLot ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
            {selectedLot || 'Todos los lotes'}
          </span>
          {selectedLot ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setSelectedLot(null); }}
              className="text-gray-400 hover:text-gray-600 p-0.5 rounded"
            >
              ✕
            </button>
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
        </button>

        {/* Dropdown */}
        {lotOpen && (
          <div className="absolute z-50 top-full mt-1 left-0 w-72 bg-white rounded-xl shadow-lg
                          border border-gray-200 overflow-hidden">
            {/* Search input */}
            <div className="p-2 border-b border-gray-100">
              <input
                autoFocus
                type="text"
                placeholder="Buscar lote..."
                value={lotSearch}
                onChange={e => setLotSearch(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg
                           focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            {/* Options list */}
            <div className="max-h-64 overflow-y-auto py-1">
              {/* All lots option */}
              <button
                type="button"
                onClick={() => { setSelectedLot(null); setLotOpen(false); }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50
                            ${!selectedLot ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}
              >
                <span>Todos los lotes</span>
                {!selectedLot && <span className="text-indigo-500 text-xs">✓</span>}
              </button>

              {lotsLoading ? (
                <div className="px-3 py-4 text-center text-sm text-gray-400">Cargando...</div>
              ) : filteredLots.length === 0 ? (
                <div className="px-3 py-4 text-center text-sm text-gray-400">Sin resultados</div>
              ) : filteredLots.map(lot => (
                <button
                  key={lot.name}
                  type="button"
                  onClick={() => { setSelectedLot(lot.name); setLotOpen(false); setLotSearch(''); }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50
                              ${selectedLot === lot.name ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}
                >
                  <span className="truncate flex-1 text-left">{lot.name}</span>
                  <span className="ml-2 text-xs text-gray-400 flex-shrink-0">{lot.count}</span>
                  {selectedLot === lot.name && <span className="ml-1 text-indigo-500 text-xs">✓</span>}
                </button>
              ))}
            </div>
          </div>
        )}
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
