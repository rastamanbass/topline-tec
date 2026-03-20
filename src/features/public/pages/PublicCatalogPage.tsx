import { useState, useMemo, useEffect } from 'react';
import PublicLayout from '../components/PublicLayout';
import GroupedPhoneCard from '../components/GroupedPhoneCard';
import FloatingCart from '../components/FloatingCart';
import { usePublicPhones } from '../hooks/usePublicPhones';
import { useReservations } from '../hooks/useReservations';
import { Search, PackageX } from 'lucide-react';
import type { Phone } from '../../../types';

export default function PublicCatalogPage() {
  const { data: phones, isLoading } = usePublicPhones();
  const { sessionId, isProcessing, toggleReservation } = useReservations();

  const [search, setSearch] = useState('');
  // State for filters
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedCondition, setSelectedCondition] = useState<string>('all');

  // Extract brands
  const brands = useMemo(() => {
    if (!phones) return [];
    const unique = new Set(phones.map((p) => p.marca));
    return Array.from(unique).sort();
  }, [phones]);

  // Filter
  const filteredPhones = useMemo(() => {
    if (!phones) return [];
    return phones.filter((p) => {
      const matchesSearch = `${p.marca} ${p.modelo}`.toLowerCase().includes(search.toLowerCase());
      const matchesBrand = selectedBrand === 'all' || p.marca === selectedBrand;
      const matchesCondition =
        selectedCondition === 'all' || (p.condition || 'Grade A') === selectedCondition;

      return matchesSearch && matchesBrand && matchesCondition;
    });
  }, [phones, search, selectedBrand, selectedCondition]);

  // Agrupar por modelo para el catálogo
  const groupedPhones = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        marca: string;
        modelo: string;
        almacenamiento?: string;
        condicion: string;
        precio: number;
        count: number;
        phones: Phone[];
      }
    >();

    filteredPhones.forEach((phone) => {
      const key = `${phone.marca}||${phone.modelo}||${phone.storage || ''}||${phone.condition || 'Grade A'}`;
      if (groups.has(key)) {
        const g = groups.get(key)!;
        g.count++;
        g.phones.push(phone);
      } else {
        groups.set(key, {
          key,
          marca: phone.marca,
          modelo: phone.modelo,
          almacenamiento: phone.storage,
          condicion: phone.condition || 'Grade A',
          precio: phone.precioVenta,
          count: 1,
          phones: [phone],
        });
      }
    });
    return Array.from(groups.values()).sort((a, b) => b.count - a.count);
  }, [filteredPhones]);

  // Get my reserved phones for the cart
  const myReservedPhones = useMemo(() => {
    if (!phones || !sessionId) return [];
    return phones.filter((p) => p.reservation?.reservedBy === sessionId);
  }, [phones, sessionId]);

  // Live countdown from earliest reservation expiry
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (myReservedPhones.length === 0) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [myReservedPhones.length]);

  const earliestExpiry = myReservedPhones.reduce((min, phone) => {
    const exp = phone.reservation?.expiresAt ?? Infinity;
    return exp < min ? exp : min;
  }, Infinity);
  const timeLeft = myReservedPhones.length > 0 ? Math.max(0, earliestExpiry - now) : 0;

  return (
    <PublicLayout>
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            {/* Search */}
            <div className="relative flex-grow w-full md:w-1/3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar modelo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </div>

          <div className="space-y-3">
            {/* Brand Filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              <span className="text-sm font-semibold text-gray-700 min-w-fit">Marcas:</span>
              <button
                onClick={() => setSelectedBrand('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                  selectedBrand === 'all'
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Todas
              </button>
              {brands.map((brand) => (
                <button
                  key={brand}
                  onClick={() => setSelectedBrand(brand)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                    selectedBrand === brand
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {brand}
                </button>
              ))}
            </div>

            {/* Condition Filter */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              <span className="text-sm font-semibold text-gray-700 min-w-fit">Condición:</span>
              <button
                onClick={() => setSelectedCondition('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                  selectedCondition === 'all'
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                Todas
              </button>
              {['New', 'Open Box', 'Grade A', 'Grade B', 'Grade C'].map((cond) => (
                <button
                  key={cond}
                  onClick={() => setSelectedCondition(cond)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                    selectedCondition === cond
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {cond}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-80 rounded-xl"></div>
            ))}
          </div>
        ) : groupedPhones.length === 0 ? (
          <div className="text-center py-20">
            <PackageX className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No encontramos resultados</h3>
            <p className="text-gray-500">Intenta con otra búsqueda o marca.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {groupedPhones.map((group) => (
              <GroupedPhoneCard
                key={group.key}
                group={group}
                sessionId={sessionId}
                onToggle={(phoneId, isReservedByMe) => toggleReservation(phoneId, isReservedByMe)}
                isProcessing={isProcessing}
              />
            ))}
          </div>
        )}
      </div>

      <FloatingCart reservedPhones={myReservedPhones} sessionId={sessionId} timeLeft={timeLeft} />
    </PublicLayout>
  );
}
