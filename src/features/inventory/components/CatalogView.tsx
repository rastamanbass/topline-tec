import type { Phone } from '../../../types';
import PhoneCard from './PhoneCard';
import { Leaf, ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { CannabisIcon } from '../../../components/icons/CannabisIcon';

interface CatalogViewProps {
  phones: Phone[];
  isLoading: boolean;
  error: unknown;
}

import { useInventoryStore } from '../stores/inventoryStore';

export default function CatalogView({ phones, isLoading, error }: CatalogViewProps) {
  const { openModal, clientViewMode } = useInventoryStore();

  // State for collapsing and pagination per lot
  const [collapsedLots, setCollapsedLots] = useState<Record<string, boolean>>({});
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});

  // High-end models keywords
  const highEndKeywords = [
    'S24',
    'S23',
    'S22',
    'Z Fold',
    'Z Flip',
    'iPhone 15',
    'iPhone 14',
    'iPhone 13',
    'Pro',
    'Ultra',
    'Max',
  ];
  const isHighEnd = (model: string | undefined) =>
    model ? highEndKeywords.some((keyword) => model.includes(keyword)) : false;

  const INITIAL_VISIBLE = 12;

  const toggleCollapse = (lot: string) => {
    setCollapsedLots((prev) => ({ ...prev, [lot]: !prev[lot] }));
  };

  const showMore = (lot: string) => {
    setVisibleCounts((prev) => ({ ...prev, [lot]: (prev[lot] || INITIAL_VISIBLE) + 24 }));
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="bg-gray-200 h-64 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error)
    return <div className="text-red-500 text-center py-10">Error al cargar inventario</div>;
  if (!phones || phones.length === 0)
    return (
      <div className="text-gray-500 text-center py-10 bg-white rounded-xl shadow-sm p-8">
        No se encontraron teléfonos
      </div>
    );

  // Group by Lot
  const phonesByLot = phones.reduce(
    (acc, phone) => {
      const lot = phone.lote || 'Sin Lote';
      if (!acc[lot]) acc[lot] = [];
      acc[lot].push(phone);
      return acc;
    },
    {} as Record<string, Phone[]>
  );

  const sortedLots = Object.keys(phonesByLot).sort((a, b) => {
    const latestA = Math.max(...phonesByLot[a].map((p) => new Date(p.fechaIngreso).getTime()));
    const latestB = Math.max(...phonesByLot[b].map((p) => new Date(p.fechaIngreso).getTime()));
    return latestB - latestA;
  });

  return (
    <div className="space-y-8">
      {sortedLots.map((lot) => {
        const items = phonesByLot[lot];
        const isCollapsed = collapsedLots[lot];
        const visible = visibleCounts[lot] || INITIAL_VISIBLE;
        const formattedItems = items.slice(0, visible);
        const hasMore = items.length > visible;

        // Calculate Lot Stats
        const stats = {
          total: items.length,
          available: items.filter((p) => p.estado === 'En Stock (Disponible para Venta)').length,
          sold: items.filter((p) => p.estado === 'Vendido' || p.estado === 'Apartado').length,
          workshop: items.filter(
            (p) => (p.estado || '').includes('Taller') || (p.estado || '').includes('Revisión')
          ).length,
        };

        return (
          <div
            key={lot}
            className="bg-white/50 rounded-2xl border border-gray-100/50 overflow-hidden transition-all"
          >
            {/* Lot Header */}
            <div
              className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-white border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => toggleCollapse(lot)}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`p-2 rounded-lg transition-colors ${isCollapsed ? 'bg-gray-200 text-gray-500' : 'bg-emerald-50 text-emerald-600'}`}
                >
                  {clientViewMode ? (
                    <Leaf className="w-5 h-5" />
                  ) : (
                    <CannabisIcon className="w-5 h-5" />
                  )}
                </div>
                <h2 className="text-lg font-bold text-gray-800">{lot}</h2>
              </div>

              {/* Stats Bar */}
              <div className="flex items-center gap-4 text-sm font-medium ml-2 sm:ml-4 overflow-x-auto">
                <span className="text-gray-600 flex items-center gap-1">
                  Total: <strong className="text-gray-900">{stats.total}</strong>
                </span>
                <span className="text-emerald-600 flex items-center gap-1">
                  Disp: <strong className="text-emerald-700">{stats.available}</strong>
                </span>
                <span className="text-blue-600 flex items-center gap-1">
                  Vend: <strong className="text-blue-700">{stats.sold}</strong>
                </span>
                <span className="text-orange-600 flex items-center gap-1">
                  Taller: <strong className="text-orange-700">{stats.workshop}</strong>
                </span>
              </div>

              <div className="ml-auto flex items-center gap-3 pl-4 border-l border-gray-100">
                {!clientViewMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openModal('create', undefined, lot);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-bold bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    + Agregar
                  </button>
                )}
                <div
                  className={`transform transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`}
                >
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Grid Content */}
            {!isCollapsed && (
              <div className="p-4 bg-slate-50/50">
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                  {formattedItems.map((phone) => (
                    <PhoneCard
                      key={phone.id}
                      phone={phone}
                      isHighEnd={isHighEnd(phone.modelo)}
                      isClientView={clientViewMode}
                    />
                  ))}
                </div>

                {hasMore && (
                  <div className="mt-8 flex justify-center">
                    <button
                      onClick={() => showMore(lot)}
                      className="bg-white border border-gray-200 shadow-sm text-gray-600 px-6 py-2 rounded-full text-sm font-bold hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2"
                    >
                      Ver {Math.min(24, items.length - visible)} más...
                      <span className="text-gray-400 text-xs font-normal">
                        ({items.length - visible} restantes)
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
