import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  DollarSign,
  Package,
  ArrowLeft,
  AlertTriangle,
  Award,
  Layers,
} from 'lucide-react';
import { useFinanceData, getPresetRange, type DateRange } from './hooks/useFinanceData';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

type Preset = 'today' | 'week' | 'month' | 'quarter' | 'year';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: '7 días' },
  { key: 'month', label: 'Este mes' },
  { key: 'quarter', label: 'Trimestre' },
  { key: 'year', label: 'Este año' },
];

export default function FinancePage() {
  const [preset, setPreset] = useState<Preset>('month');
  const [range, setRange] = useState<DateRange>(getPresetRange('month'));
  const [activeTab, setActiveTab] = useState<'resumen' | 'modelos' | 'lotes' | 'deuda'>('resumen');

  const { data, isLoading } = useFinanceData(range);

  const handlePreset = (p: Preset) => {
    setPreset(p);
    setRange(getPresetRange(p));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 h-16">
            <Link to="/dashboard" className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Finanzas</h1>
                <p className="text-xs text-gray-500">Rentabilidad y análisis financiero</p>
              </div>
            </div>

            {/* Date Preset Buttons */}
            <div className="ml-auto flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {PRESETS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => handlePreset(p.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    preset === p.key
                      ? 'bg-white shadow-sm text-emerald-700 font-bold'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <LoadingSkeleton />
        ) : !data ? (
          <div className="text-center py-20 text-gray-400">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No hay datos para mostrar</p>
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiCard
                label="Ingresos"
                value={fmt(data.summary.revenue)}
                icon={<DollarSign className="w-5 h-5 text-blue-500" />}
                color="blue"
              />
              <KpiCard
                label="Ganancia Bruta"
                value={fmt(data.summary.grossProfit)}
                sub={fmtPct(data.summary.grossMarginPct) + ' margen'}
                icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
                color={data.summary.grossMarginPct >= 15 ? 'emerald' : 'orange'}
              />
              <KpiCard
                label="Unidades Vendidas"
                value={String(data.summary.unitsSold)}
                sub={fmt(data.summary.avgOrderValue) + ' AOV'}
                icon={<Package className="w-5 h-5 text-purple-500" />}
                color="purple"
              />
              <KpiCard
                label="Deuda Pendiente"
                value={fmt(data.summary.totalDebt)}
                sub={`Crédito clientes: ${fmt(data.summary.totalCredit)}`}
                icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
                color="red"
              />
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 w-fit">
              {[
                { key: 'resumen', label: 'Resumen' },
                { key: 'modelos', label: 'Top Modelos' },
                { key: 'lotes', label: 'P&L por Lote' },
                { key: 'deuda', label: 'Deudores' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                    activeTab === tab.key
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'resumen' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* P&L Summary */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Estado de Resultados
                  </h3>
                  <div className="space-y-3">
                    <PLRow label="Ingresos por Ventas" value={data.summary.revenue} type="income" />
                    <PLRow
                      label="Costo de Mercancía (COGS)"
                      value={-data.summary.cogs}
                      type="cost"
                    />
                    <div className="border-t border-gray-200 pt-3">
                      <PLRow
                        label="Ganancia Bruta"
                        value={data.summary.grossProfit}
                        type="total"
                        showMargin={data.summary.grossMarginPct}
                      />
                    </div>
                  </div>
                </div>

                {/* Quick metrics */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="font-bold text-gray-800 mb-4">Métricas Clave</h3>
                  <div className="space-y-4">
                    <MetricRow
                      label="Margen Bruto"
                      value={fmtPct(data.summary.grossMarginPct)}
                      target="≥ 20%"
                      good={data.summary.grossMarginPct >= 20}
                    />
                    <MetricRow
                      label="Precio promedio (AOV)"
                      value={fmt(data.summary.avgOrderValue)}
                      target="Benchmark: $502"
                      good={data.summary.avgOrderValue >= 300}
                    />
                    <MetricRow
                      label="Unidades vendidas"
                      value={String(data.summary.unitsSold)}
                      target={preset === 'month' ? 'Meta: 50/mes' : ''}
                      good={preset === 'month' ? data.summary.unitsSold >= 50 : true}
                    />
                    <MetricRow
                      label="Deuda total clientes"
                      value={fmt(data.summary.totalDebt)}
                      target="Ideal: 0"
                      good={data.summary.totalDebt === 0}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'modelos' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                  <Award className="w-4 h-4 text-yellow-500" />
                  <h3 className="font-bold text-gray-800">Top Modelos por Ingresos</h3>
                  <span className="ml-auto text-xs text-gray-400">
                    {data.topModels.length} modelos
                  </span>
                </div>
                {data.topModels.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">No hay ventas en este período</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                          <th className="text-left px-4 py-3">Modelo</th>
                          <th className="text-right px-4 py-3">Unidades</th>
                          <th className="text-right px-4 py-3">Ingresos</th>
                          <th className="text-right px-4 py-3">Ganancia</th>
                          <th className="text-right px-4 py-3">Margen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {data.topModels.map((m, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <span className="text-gray-400 text-xs mr-2">#{i + 1}</span>
                              <span className="font-medium text-gray-900">
                                {m.marca} {m.modelo}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">{m.count}</td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">
                              {fmt(m.revenue)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-emerald-600">
                              {fmt(m.profit)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <MarginBadge margin={m.margin} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'lotes' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-500" />
                  <h3 className="font-bold text-gray-800">P&amp;L por Lote</h3>
                </div>
                {data.lotStats.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">No hay lotes en este período</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-xs uppercase font-medium">
                          <th className="text-left px-4 py-3">Lote</th>
                          <th className="text-right px-4 py-3">Comprados</th>
                          <th className="text-right px-4 py-3">Vendidos</th>
                          <th className="text-right px-4 py-3">Stock</th>
                          <th className="text-right px-4 py-3">Ingresos</th>
                          <th className="text-right px-4 py-3">Ganancia</th>
                          <th className="text-right px-4 py-3">Margen</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {data.lotStats.map((l) => (
                          <tr key={l.lote} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{l.lote}</td>
                            <td className="px-4 py-3 text-right text-gray-500">{l.unitsBought}</td>
                            <td className="px-4 py-3 text-right text-blue-600 font-medium">
                              {l.unitsSold}
                            </td>
                            <td className="px-4 py-3 text-right text-emerald-600">
                              {l.unsoldStock}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">
                              {l.revenue > 0 ? fmt(l.revenue) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-emerald-600">
                              {l.profit > 0 ? fmt(l.profit) : '—'}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {l.margin > 0 ? <MarginBadge margin={l.margin} /> : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'deuda' && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <h3 className="font-bold text-gray-800">Clientes con Deuda</h3>
                  <span className="ml-auto text-xs font-medium text-red-600">
                    Total: {fmt(data.summary.totalDebt)}
                  </span>
                </div>
                {data.topDebtors.length === 0 ? (
                  <div className="p-8 text-center text-emerald-600 font-medium">
                    Sin deudas pendientes
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {data.topDebtors.map((d, i) => (
                      <div
                        key={d.clientId}
                        className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50"
                      >
                        <span className="text-gray-400 text-xs w-5">#{i + 1}</span>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{d.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600">{fmt(d.totalDebt)}</p>
                          <p className="text-xs text-gray-400">deuda pendiente</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// Sub-components
function KpiCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: 'blue' | 'emerald' | 'purple' | 'red' | 'orange';
}) {
  const colors = {
    blue: 'bg-blue-50 border-blue-100',
    emerald: 'bg-emerald-50 border-emerald-100',
    purple: 'bg-purple-50 border-purple-100',
    red: 'bg-red-50 border-red-100',
    orange: 'bg-orange-50 border-orange-100',
  };
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]} shadow-sm`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium text-gray-500 uppercase">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

function PLRow({
  label,
  value,
  type,
  showMargin,
}: {
  label: string;
  value: number;
  type: 'income' | 'cost' | 'total';
  showMargin?: number;
}) {
  const styles = {
    income: 'text-gray-700',
    cost: 'text-red-600',
    total: 'text-emerald-700 font-bold text-lg',
  };
  return (
    <div className={`flex justify-between items-center ${type === 'total' ? 'font-bold' : ''}`}>
      <span className="text-gray-600 text-sm">{label}</span>
      <div className="text-right">
        <span className={`font-medium ${styles[type]}`}>
          {value < 0 ? `-${fmt(Math.abs(value))}` : fmt(value)}
        </span>
        {showMargin !== undefined && (
          <span className="ml-2 text-xs text-gray-400">({fmtPct(showMargin)})</span>
        )}
      </div>
    </div>
  );
}

function MetricRow({
  label,
  value,
  target,
  good,
}: {
  label: string;
  value: string;
  target: string;
  good: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {target && <p className="text-xs text-gray-400">{target}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className="font-bold text-gray-900">{value}</span>
        <span className={`w-2 h-2 rounded-full ${good ? 'bg-emerald-400' : 'bg-orange-400'}`} />
      </div>
    </div>
  );
}

function MarginBadge({ margin }: { margin: number }) {
  const color =
    margin >= 20
      ? 'bg-emerald-100 text-emerald-700'
      : margin >= 10
        ? 'bg-yellow-100 text-yellow-700'
        : 'bg-red-100 text-red-700';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{fmtPct(margin)}</span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-2xl" />
        ))}
      </div>
      <div className="h-64 bg-gray-200 rounded-2xl" />
    </div>
  );
}
