import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  TrendingDown,
  Package,
  Users,
  Wrench,
  CheckCircle2,
} from 'lucide-react';
import { useInsightsData, type AgingBucket } from './hooks/useInsightsData';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);

const fmtPct = (n: number) => `${Math.round(n)}%`;

// ── Color helpers ─────────────────────────────────────────────────────────────
const BUCKET_STYLES: Record<AgingBucket['key'], { bg: string; text: string; border: string; badge: string }> = {
  fast:     { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  normal:   { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    badge: 'bg-blue-100 text-blue-700' },
  slow:     { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  badge: 'bg-orange-100 text-orange-700' },
  critical: { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     badge: 'bg-red-100 text-red-700' },
};

const sellThroughColor = (pct: number) =>
  pct >= 80 ? 'text-emerald-600 bg-emerald-50' : pct >= 50 ? 'text-amber-600 bg-amber-50' : 'text-red-600 bg-red-50';

const daysColor = (days: number | null) =>
  days === null ? 'text-gray-400' : days <= 14 ? 'text-emerald-600' : days <= 30 ? 'text-amber-600' : 'text-red-600';

const riskColor = (level: string) =>
  level === 'high' ? 'bg-red-500' : level === 'medium' ? 'bg-amber-400' : 'bg-emerald-400';

// ── Skeleton ─────────────────────────────────────────────────────────────────
function SectionSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-12 bg-gray-100 rounded-xl" />
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function InsightsPage() {
  const { agingBuckets, lotVelocity, clientRisk, repairBurden, isLoading } =
    useInsightsData();

  const defaultOpen =
    agingBuckets?.find((b) => b.key === 'critical' && b.count > 0)?.key ||
    agingBuckets?.find((b) => b.key === 'slow' && b.count > 0)?.key ||
    'normal';

  const [openBucket, setOpenBucket] = useState<string | null>(defaultOpen ?? null);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link to="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Cuellos de Botella</h1>
            <p className="text-xs text-gray-400">Métricas de operación real · datos confiables</p>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8">

        {/* ── PANEL 1: Inventory Aging ──────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Inventario sin rotar
            </h2>
          </div>

          {isLoading ? (
            <SectionSkeleton />
          ) : (
            <>
              {/* Chips */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {agingBuckets.map((b) => {
                  const s = BUCKET_STYLES[b.key];
                  const active = openBucket === b.key;
                  return (
                    <button
                      key={b.key}
                      onClick={() => setOpenBucket(active ? null : b.key)}
                      className={`rounded-xl border p-3 text-center transition-all ${
                        active ? `${s.bg} ${s.border}` : 'bg-white border-gray-100'
                      }`}
                    >
                      <p className={`text-2xl font-bold ${active ? s.text : 'text-gray-900'}`}>
                        {b.count}
                      </p>
                      <p className={`text-xs font-medium mt-0.5 ${active ? s.text : 'text-gray-400'}`}>
                        {b.label}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* All buckets look healthy */}
              {agingBuckets.every((b) => b.key === 'fast' || b.key === 'normal' || b.count === 0) &&
                agingBuckets.find((b) => b.key === 'slow')?.count === 0 &&
                agingBuckets.find((b) => b.key === 'critical')?.count === 0 && (
                  <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-emerald-700 text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    Todo el inventario rota bien — ningún equipo lleva más de 30 días en stock
                  </div>
                )}

              {/* Expanded bucket */}
              {openBucket && (() => {
                const bucket = agingBuckets.find((b) => b.key === openBucket);
                if (!bucket || bucket.count === 0) return (
                  <div className="bg-white rounded-xl border border-gray-100 px-4 py-6 text-center text-gray-400 text-sm">
                    Sin equipos en este rango
                  </div>
                );
                const s = BUCKET_STYLES[bucket.key];
                return (
                  <div className={`rounded-xl border overflow-hidden ${s.border}`}>
                    <div className="divide-y divide-gray-50">
                      {bucket.phones.map((p) => (
                        <div key={p.id} className="flex items-center gap-3 px-4 py-3 bg-white">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {p.marca} {p.modelo}{p.storage ? ` · ${p.storage}` : ''}
                            </p>
                            <p className="text-xs font-mono text-gray-400 truncate">{p.imei}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-gray-900">{fmt(p.precioVenta)}</p>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${s.badge}`}>
                              {p.days}d
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </section>

        {/* ── PANEL 2: Lot Velocity ─────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Velocidad por lote
            </h2>
            <span className="text-xs text-gray-400 ml-1">— peores primero</span>
          </div>

          {isLoading ? (
            <SectionSkeleton />
          ) : lotVelocity.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-6 text-center text-gray-400 text-sm">
              Sin datos de lotes aún
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase font-medium border-b border-gray-100">
                    <th className="text-left px-4 py-3">Lote</th>
                    <th className="text-center px-3 py-3">Total</th>
                    <th className="text-center px-3 py-3">Vendidos</th>
                    <th className="text-center px-3 py-3">En Stock</th>
                    <th className="text-center px-3 py-3">Sell-through</th>
                    <th className="text-center px-3 py-3">Días prom.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {lotVelocity.map((l) => (
                    <tr key={l.lote} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-[140px]">
                        {l.lote}
                      </td>
                      <td className="px-3 py-3 text-center text-gray-500">{l.total}</td>
                      <td className="px-3 py-3 text-center text-gray-500">{l.sold}</td>
                      <td className="px-3 py-3 text-center text-gray-500">{l.inStock}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${sellThroughColor(l.sellThroughPct)}`}>
                          {fmtPct(l.sellThroughPct)}
                        </span>
                      </td>
                      <td className={`px-3 py-3 text-center text-sm font-semibold ${daysColor(l.avgDaysToSell)}`}>
                        {l.avgDaysToSell !== null ? `${l.avgDaysToSell}d` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── PANEL 3: Client Credit Risk ───────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Riesgo de crédito
            </h2>
          </div>

          {isLoading ? (
            <SectionSkeleton />
          ) : clientRisk.length === 0 ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-emerald-700 text-sm font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Todos los clientes al día — sin deudas pendientes
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-50">
                {clientRisk.map((c) => (
                  <div key={c.clientId} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                      <div className="flex items-center gap-3 text-xs font-bold">
                        <span className="text-red-600">{fmt(c.debtAmount)} deuda</span>
                        {c.creditAmount > 0 && (
                          <span className="text-emerald-600">{fmt(c.creditAmount)} créd.</span>
                        )}
                      </div>
                    </div>
                    {/* Utilization bar */}
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${riskColor(c.riskLevel)}`}
                        style={{ width: `${Math.min(100, c.utilizationPct)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {Math.round(c.utilizationPct)}% de utilización de crédito ·{' '}
                      {c.riskLevel === 'high' ? '⚠️ Riesgo alto' : c.riskLevel === 'medium' ? 'Riesgo medio' : 'Riesgo bajo'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── PANEL 4: Repair Burden ────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Carga de reparaciones por modelo
            </h2>
          </div>

          {isLoading ? (
            <SectionSkeleton />
          ) : repairBurden.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 px-4 py-6 text-center text-gray-400 text-sm">
              Sin costos de reparación registrados
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase font-medium border-b border-gray-100">
                      <th className="text-left px-4 py-3">Modelo</th>
                      <th className="text-center px-3 py-3">Reparac.</th>
                      <th className="text-center px-3 py-3">Equipos</th>
                      <th className="text-right px-4 py-3">Costo total</th>
                      <th className="text-right px-4 py-3">Prom. c/u</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {repairBurden.map((r) => (
                      <tr key={r.model} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{r.model}</td>
                        <td className="px-3 py-3 text-center text-gray-500">{r.repairCount}</td>
                        <td className="px-3 py-3 text-center text-gray-500">{r.phonesAffected}</td>
                        <td className="px-4 py-3 text-right font-bold text-red-600">
                          {fmt(r.totalRepairCost)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {fmt(r.avgCostPerRepair)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-2 px-1">
                Estos modelos pueden requerir un margen adicional al momento de comprar.
              </p>
            </>
          )}
        </section>

      </main>
    </div>
  );
}
