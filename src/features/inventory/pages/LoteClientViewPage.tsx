import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Package, Clock, Printer } from 'lucide-react';
import { usePhones } from '../hooks/usePhones';
import { phoneLabel } from '../../../lib/phoneUtils';

const humanizeLote = (lote: string): string => {
  if (!lote) return 'Sin lote';
  return lote
    .replace(/_/g, ' ')
    .replace(/\b(\w)/g, (c) => c.toUpperCase())
    .replace(/Amerijet/i, '· Amerijet')
    .replace(/Legacy Import/i, 'Importación Legacy')
    .trim();
};

const TALLER_STATES = [
  'Enviado a Taller (Garantía)',
  'Enviado a Taller (Externo)',
  'En Taller (Recibido)',
  'Enviado a Gerencia (Pendiente)',
  'Enviado a Gerencia',
];

export default function LoteClientViewPage() {
  const { loteId } = useParams<{ loteId: string }>();
  const decoded = decodeURIComponent(loteId ?? '');
  const loteLabel = humanizeLote(decoded);

  const { data: phones = [], isLoading } = usePhones({ lot: decoded });

  // ── Available: group by model ──────────────────────────────────────────────
  const availableGroups = useMemo(() => {
    const inStock = phones.filter(
      (p) => p.estado === 'En Stock (Disponible para Venta)'
    );
    const map = new Map<
      string,
      { label: string; storage?: string; condition?: string; count: number; precio: number }
    >();
    inStock.forEach((p) => {
      const key = `${p.marca}|${p.modelo}|${p.storage ?? ''}|${p.condition ?? ''}`;
      if (map.has(key)) {
        map.get(key)!.count++;
      } else {
        map.set(key, {
          label: phoneLabel(p.marca, p.modelo),
          storage: p.storage,
          condition: p.condition,
          count: 1,
          precio: p.precioVenta,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [phones]);

  // ── Workshop phones ────────────────────────────────────────────────────────
  const workshopGroups = useMemo(() => {
    const ws = phones.filter((p) => TALLER_STATES.includes(p.estado));
    const map = new Map<
      string,
      { label: string; estado: string; count: number }
    >();
    ws.forEach((p) => {
      const key = `${p.marca}|${p.modelo}|${p.estado}`;
      if (map.has(key)) {
        map.get(key)!.count++;
      } else {
        map.set(key, {
          label: `${phoneLabel(p.marca, p.modelo)}${p.storage ? ' ' + p.storage : ''}`,
          estado: p.estado,
          count: 1,
        });
      }
    });
    return Array.from(map.values());
  }, [phones]);

  // ── Reserved ──────────────────────────────────────────────────────────────
  const reservedGroups = useMemo(() => {
    const res = phones.filter((p) => p.estado === 'Apartado');
    const map = new Map<string, { label: string; count: number; precio: number }>();
    res.forEach((p) => {
      const key = `${p.marca}|${p.modelo}|${p.storage ?? ''}`;
      if (map.has(key)) {
        map.get(key)!.count++;
      } else {
        map.set(key, {
          label: `${phoneLabel(p.marca, p.modelo)}${p.storage ? ' ' + p.storage : ''}`,
          count: 1,
          precio: p.precioVenta,
        });
      }
    });
    return Array.from(map.values());
  }, [phones]);

  const totalAvailable = availableGroups.reduce((s, g) => s + g.count, 0);
  const prices = availableGroups.filter((g) => g.precio > 0).map((g) => g.precio);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!decoded || phones.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <Package className="w-12 h-12 text-gray-300" />
        <p className="text-gray-500 text-lg">Lote no encontrado o vacío</p>
        <Link to="/inventory" className="text-primary-600 hover:underline text-sm">
          Volver al inventario
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 print:border-gray-200 sticky top-0 z-10 print:static">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/inventory"
              className="text-gray-400 hover:text-gray-600 transition-colors print:hidden"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-widest leading-none mb-0.5 print:hidden">
                Top Line Tec · Vista Cliente
              </p>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">{loteLabel}</h1>
            </div>
          </div>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors print:hidden"
          >
            <Printer className="w-4 h-4" />
            Imprimir
          </button>
        </div>
      </header>

      {/* ── Summary bar ── */}
      {totalAvailable > 0 && (
        <div className="max-w-4xl mx-auto px-6 py-4 print:py-2">
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <span>
              <strong className="text-gray-900 text-base">{totalAvailable}</strong>{' '}
              equipo{totalAvailable !== 1 ? 's' : ''} disponible{totalAvailable !== 1 ? 's' : ''}
            </span>
            {prices.length > 0 && (
              <span>
                Desde{' '}
                <strong className="text-emerald-700">
                  ${minPrice.toLocaleString()}
                </strong>
                {maxPrice > minPrice && (
                  <>
                    {' '}hasta{' '}
                    <strong className="text-emerald-700">
                      ${maxPrice.toLocaleString()}
                    </strong>
                  </>
                )}
              </span>
            )}
          </div>
        </div>
      )}

      <main className="max-w-4xl mx-auto px-6 pb-12 space-y-6 print:space-y-4">

        {/* ── Disponibles para Venta ── */}
        {availableGroups.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:border-gray-200 print:shadow-none print:rounded-none">
            {/* Section header */}
            <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                Disponibles para Venta
              </h2>
              <span className="ml-auto text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                {totalAvailable} equipos
              </span>
            </div>

            {/* Table */}
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-50">
                  <th className="text-left px-6 py-3 font-semibold">Modelo</th>
                  <th className="text-left px-4 py-3 font-semibold hidden sm:table-cell">Condición</th>
                  <th className="text-center px-4 py-3 font-semibold">Cant.</th>
                  <th className="text-right px-6 py-3 font-semibold">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {availableGroups.map((g, i) => (
                  <tr
                    key={i}
                    className="hover:bg-gray-50/50 transition-colors print:hover:bg-transparent"
                  >
                    <td className="px-6 py-3.5">
                      <span className="font-semibold text-gray-900">{g.label}</span>
                      {g.storage && (
                        <span className="ml-2 text-xs text-gray-400">{g.storage}</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden sm:table-cell">
                      {g.condition ? (
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {g.condition}
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-emerald-50 text-emerald-700 font-bold text-sm rounded-lg">
                        {g.count}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      {g.precio > 0 ? (
                        <span className="font-bold text-emerald-700 text-base">
                          ${g.precio.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-xs text-orange-500 font-medium">Sin precio</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── Apartados ── */}
        {reservedGroups.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:border-gray-200 print:shadow-none print:rounded-none">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                Apartados
              </h2>
              <span className="ml-auto text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                {reservedGroups.reduce((s, g) => s + g.count, 0)} equipos
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-50">
                  <th className="text-left px-6 py-3 font-semibold">Modelo</th>
                  <th className="text-center px-4 py-3 font-semibold">Cant.</th>
                  <th className="text-right px-6 py-3 font-semibold">Precio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reservedGroups.map((g, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-gray-700">{g.label}</td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-amber-50 text-amber-700 font-bold text-sm rounded-lg">
                        {g.count}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right font-bold text-amber-700">
                      {g.precio > 0 ? `$${g.precio.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* ── En Proceso de Taller ── */}
        {workshopGroups.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:border-gray-200 print:shadow-none print:rounded-none">
            <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-400" />
              <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                En Proceso de Taller
              </h2>
              <span className="ml-auto text-xs font-semibold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
                {workshopGroups.reduce((s, g) => s + g.count, 0)} equipos
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wide border-b border-gray-50">
                  <th className="text-left px-6 py-3 font-semibold">Modelo</th>
                  <th className="text-left px-4 py-3 font-semibold">Estado</th>
                  <th className="text-center px-6 py-3 font-semibold">Cant.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {workshopGroups.map((g, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3.5 font-semibold text-gray-700">{g.label}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-medium text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full">
                        {g.estado}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-orange-50 text-orange-700 font-bold text-sm rounded-lg">
                        {g.count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Empty state */}
        {availableGroups.length === 0 && workshopGroups.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400">Este lote no tiene equipos activos en este momento.</p>
          </div>
        )}

        {/* Footer */}
        <p className="text-xs text-gray-300 text-center pt-2 print:text-gray-500">
          Top Line Tec · Precios sujetos a cambio sin previo aviso ·{' '}
          {new Date().toLocaleDateString('es-SV', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </main>
    </div>
  );
}
