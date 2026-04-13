import { useState } from 'react';
import { useAuth } from '../../context';
import { canViewCosts } from '../../lib/permissions';
import {
  LogOut,
  User,
  Smartphone,
  Users,
  PenTool,
  AlertCircle,
  Clock,
  TrendingUp,
  ShoppingBag,
  Package,
  DollarSign,
  BarChart2,
  ArrowUpRight,
  ArrowDownRight,
  PackageCheck,
  AlertTriangle,
  Activity,
  Timer,
  Wrench,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useDashboardStats, type DashboardPeriod } from './hooks/useDashboardStats';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('es-SV', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);

function RepairCostCard({ repairCostImpact }: { repairCostImpact: number }) {
  const { user } = useAuth();
  if (!canViewCosts(user?.email)) return null;
  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm ${
        repairCostImpact === 0
          ? 'bg-emerald-50 border-emerald-100'
          : 'bg-orange-50 border-orange-100'
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <Wrench
          className={`w-4 h-4 ${repairCostImpact === 0 ? 'text-emerald-600' : 'text-orange-600'}`}
        />
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          Costo reparaciones no cobradas
        </span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{fmt(repairCostImpact)}</p>
      <p className="text-xs text-gray-500 mt-1">
        {repairCostImpact === 0
          ? 'Sin reparaciones pendientes de cobro ✓'
          : 'Deducir de las ganancias del período'}
      </p>
    </div>
  );
}

export default function DashboardPage() {
  const { user, userRole, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Sesión cerrada');
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Error al cerrar sesión');
    }
  };

  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || 'usuario';

  const isAdminOrGerente = ['admin', 'gerente'].includes(userRole || '');
  const isTaller = userRole === 'taller';
  const isComprador = userRole === 'comprador';

  const [period, setPeriod] = useState<DashboardPeriod>('3m');

  const periodLabel: Record<DashboardPeriod, string> = {
    '3m': 'Últimos 3 meses',
    '6m': 'Últimos 6 meses',
    '1y': 'Último año',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div>
              <h1 className="text-xl font-bold text-primary-600">Top Line Tec</h1>
              <p className="text-xs text-gray-500">Sistema de Gestión Mayorista</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-600" />
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-gray-900">{user?.displayName}</p>
                  <p className="text-xs text-gray-500 capitalize">{userRole}</p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Salir
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Greeting + period selector */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Hola, {firstName}</h2>
            {!isComprador && <p className="text-sm text-gray-500">{periodLabel[period]}</p>}
          </div>
          {isAdminOrGerente && !isTaller && (
            <div className="flex bg-gray-100 rounded-xl p-1 gap-1 self-start">
              {(['3m', '6m', '1y'] as DashboardPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    period === p
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p === '3m' ? '3 meses' : p === '6m' ? '6 meses' : '1 año'}
                </button>
              ))}
            </div>
          )}
        </div>

        {isTaller ? (
          <TallerView />
        ) : isComprador ? (
          <CompradorView />
        ) : (
          <AdminView userRole={userRole || ''} period={period} />
        )}

        {/* Navigation Grid */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Módulos
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <NavCard
              to="/inventory"
              icon={<Smartphone className="w-5 h-5 text-primary-600" />}
              bg="bg-primary-50"
              label="Inventario"
              sub="Teléfonos y stock"
            />
            {!isComprador && (
              <NavCard
                to="/clients"
                icon={<Users className="w-5 h-5 text-green-600" />}
                bg="bg-green-50"
                label="Clientes"
                sub="Directorio y créditos"
              />
            )}
            {!isComprador && (
              <NavCard
                to="/taller"
                icon={<PenTool className="w-5 h-5 text-orange-600" />}
                bg="bg-orange-50"
                label="Taller"
                sub="Reparaciones"
              />
            )}
            {!isComprador && (
              <NavCard
                to="/accesorios"
                icon={<Package className="w-5 h-5 text-purple-600" />}
                bg="bg-purple-50"
                label="Accesorios"
                sub="Cables, cases"
              />
            )}
            <NavCard
              to="/catalog"
              icon={<BarChart2 className="w-5 h-5 text-emerald-600" />}
              bg="bg-emerald-50"
              label="Catálogo"
              sub="Precios y modelos"
            />
            <NavCard
              to="/recepcion"
              icon={<PackageCheck className="w-5 h-5 text-teal-600" />}
              bg="bg-teal-50"
              label="Recepción"
              sub="Recibir envíos de USA"
            />
            {isAdminOrGerente && (
              <NavCard
                to="/insights"
                icon={<Activity className="w-5 h-5 text-rose-600" />}
                bg="bg-rose-50"
                label="Insights"
                sub="Cuellos de botella"
                highlight
              />
            )}
            {isAdminOrGerente && (
              <>
                <NavCard
                  to="/finanzas"
                  icon={<TrendingUp className="w-5 h-5 text-emerald-700" />}
                  bg="bg-emerald-50"
                  label="Finanzas"
                  sub="P&L y reportes"
                  highlight
                />
                <NavCard
                  to="/ventas"
                  icon={<ShoppingBag className="w-5 h-5 text-blue-600" />}
                  bg="bg-blue-50"
                  label="Ventas"
                  sub="Historial"
                />
                <NavCard
                  to="/ordenes"
                  icon={<ShoppingBag className="w-5 h-5 text-indigo-600" />}
                  bg="bg-indigo-50"
                  label="Ordenes"
                  sub="Pedidos B2B online"
                  highlight
                />
                <NavCard
                  to="/admin/usuarios"
                  icon={<User className="w-5 h-5 text-gray-600" />}
                  bg="bg-gray-100"
                  label="Usuarios"
                  sub="Compradores B2B"
                />
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Comprador view ────────────────────────────────────────────────────────────

function CompradorView() {
  const { stats, isLoading } = useDashboardStats();

  return (
    <div className="space-y-4">
      {/* Stock disponible */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Equipos disponibles
            </p>
            {isLoading || !stats ? (
              <div className="h-8 w-16 bg-gray-200 rounded-lg animate-pulse mt-1" />
            ) : (
              <p className="text-3xl font-bold text-gray-900 leading-none">{stats.inStock}</p>
            )}
          </div>
        </div>
        <Link
          to="/catalog"
          className="flex items-center justify-center gap-2 w-full py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors text-sm shadow-sm"
        >
          Ver Catálogo
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Mis pedidos */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Mis pedidos</p>
            <p className="text-xs text-gray-400">Historial de ordenes</p>
          </div>
        </div>
        <Link to="/mis-pedidos" className="text-sm font-semibold text-primary-600 hover:underline">
          Ver todos →
        </Link>
      </div>
    </div>
  );
}

// ── Admin / Gerente / Vendedor view ──────────────────────────────────────────

function AdminView({ userRole, period }: { userRole: string; period: DashboardPeriod }) {
  const { stats, isLoading } = useDashboardStats(period);
  const isAdminOrGerente = ['admin', 'gerente'].includes(userRole);

  const periodShort = period === '3m' ? '3 meses' : period === '6m' ? '6 meses' : '1 año';

  if (isLoading || !stats) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="h-56 bg-gray-200 rounded-2xl" />
          <div className="h-56 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* GMV */}
        <KpiCard
          label={`Ventas (${periodShort})`}
          value={fmt(stats.monthRevenue)}
          sub={
            stats.monthRevenue === 0
              ? 'Sin ventas en el período'
              : stats.revenueChangePct !== null
                ? `${stats.revenueChangePct >= 0 ? '+' : ''}${stats.revenueChangePct.toFixed(0)}% vs período ant.`
                : `${stats.monthUnitsSold} unidades`
          }
          trend={stats.monthRevenue === 0 ? undefined : stats.revenueChangePct}
          icon={<DollarSign className="w-5 h-5" />}
          color="blue"
          hidden={!isAdminOrGerente}
        />

        {/* Stock vencido */}
        <KpiCard
          label="Stock vencido"
          value={String(stats.staleStock)}
          sub={
            stats.staleStock === 0
              ? 'Todo el inventario es reciente'
              : `equipo${stats.staleStock !== 1 ? 's' : ''} sin vender +30 días`
          }
          icon={<AlertTriangle className="w-5 h-5" />}
          color={stats.staleStock === 0 ? 'emerald' : stats.staleStock <= 5 ? 'orange' : 'red'}
          hidden={!isAdminOrGerente}
        />

        {/* Stock disponible */}
        <KpiCard
          label="En stock"
          value={String(stats.inStock)}
          sub={stats.reserved > 0 ? `${stats.reserved} apartados` : 'Disponibles para venta'}
          icon={<Smartphone className="w-5 h-5" />}
          color="purple"
        />

        {/* Deuda clientes */}
        <KpiCard
          label="Deuda clientes"
          value={fmt(stats.totalClientDebt)}
          sub={stats.workshopDebt > 0 ? `+ ${fmt(stats.workshopDebt)} taller` : 'Deuda pendiente'}
          icon={<Users className="w-5 h-5" />}
          color={stats.totalClientDebt > 0 ? 'red' : 'emerald'}
          hidden={!isAdminOrGerente}
        />
      </div>

      {/* Monthly Revenue Trend */}
      {isAdminOrGerente && stats.monthlyRevenueTrend && stats.monthlyRevenueTrend.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Tendencia de Ingresos</h3>
              <p className="text-xs text-gray-400">Por mes · {periodShort}</p>
            </div>
            {stats.avgRevenuePerUnit > 0 && (
              <div className="text-right">
                <p className="text-xs text-gray-400">Avg por unidad</p>
                <p className="text-sm font-bold text-gray-700">{fmt(stats.avgRevenuePerUnit)}</p>
              </div>
            )}
          </div>
          <div className="px-5 py-4">
            {(() => {
              const maxRevenue = Math.max(...stats.monthlyRevenueTrend.map((m) => m.revenue), 1);
              return (
                <div className="flex items-end gap-2 h-36">
                  {stats.monthlyRevenueTrend.map((m, i) => {
                    const heightPct = (m.revenue / maxRevenue) * 100;
                    const isCurrentMonth = i === stats.monthlyRevenueTrend!.length - 1;
                    const isEmpty = m.revenue === 0;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <div
                          className="w-full flex flex-col justify-end"
                          style={{ height: '108px' }}
                        >
                          {isCurrentMonth && isEmpty ? (
                            // Current month with no data yet: dashed outline bar as placeholder
                            <div
                              className="w-full rounded-t-sm border-2 border-dashed border-primary-200"
                              style={{ height: '20%' }}
                              title={`${m.month}: mes en curso`}
                            />
                          ) : (
                            <div
                              className={`w-full rounded-t-sm transition-all ${
                                isEmpty
                                  ? 'bg-gray-100'
                                  : isCurrentMonth
                                    ? 'bg-primary-400'
                                    : 'bg-primary-600'
                              }`}
                              style={{ height: `${Math.max(heightPct, 4)}%` }}
                              title={`${m.month}: ${fmt(m.revenue)} · ${m.units} uds`}
                            />
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate w-full text-center">
                          {m.month}
                        </p>
                        {isCurrentMonth && (
                          <p className="text-xs text-primary-300 truncate w-full text-center leading-tight">
                            parcial
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* BI Row: Rentabilidad Real */}
      {isAdminOrGerente && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Precio promedio por equipo */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm text-blue-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wide opacity-70">
                Precio prom. / equipo
              </span>
              <DollarSign className="w-4 h-4 opacity-60" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{fmt(stats.avgRevenuePerUnit)}</p>
            <p className="text-xs mt-1 opacity-70">
              {stats.monthUnitsSold > 0
                ? `Basado en ${stats.monthUnitsSold} ventas del período`
                : 'Sin ventas en el período'}
            </p>
          </div>

          {/* Equipos en SV */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 shadow-sm text-indigo-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wide opacity-70">
                Equipos en SV
              </span>
              <Smartphone className="w-4 h-4 opacity-60" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.inStock + stats.reserved}</p>
            <p className="text-xs mt-1 opacity-70">
              {stats.inTransitTotal > 0
                ? `+ ${stats.inTransitTotal} en tránsito`
                : 'En inventario local'}
            </p>
          </div>

          {/* Días promedio para vender */}
          <div
            className={`rounded-2xl border p-4 shadow-sm ${
              stats.avgDaysToSell === 0
                ? 'bg-gray-50 border-gray-100 text-gray-500'
                : stats.avgDaysToSell <= 20
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
                  : stats.avgDaysToSell <= 35
                    ? 'bg-amber-50 border-amber-100 text-amber-700'
                    : 'bg-red-50 border-red-100 text-red-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wide opacity-70">
                Días para vender
              </span>
              <Timer className="w-4 h-4 opacity-60" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {stats.avgDaysToSell === 0 ? '—' : `${stats.avgDaysToSell.toFixed(0)}d`}
            </p>
            <p className="text-xs mt-1 opacity-70">
              {stats.avgDaysToSell === 0
                ? 'Sin ventas en el período'
                : stats.avgDaysToSell <= 20
                  ? 'Rotación excelente ✓'
                  : stats.avgDaysToSell <= 35
                    ? 'Rotación normal'
                    : 'Rotación lenta — revisar precios'}
            </p>
          </div>
        </div>
      )}

      {/* Pipeline projection row */}
      {isAdminOrGerente && stats.projectedTransitRevenue > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-teal-100 bg-teal-50 p-4 shadow-sm col-span-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Pipeline en tránsito
              </span>
              <Package className="w-4 h-4 text-teal-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmt(stats.projectedTransitRevenue)}</p>
            <p className="text-xs text-teal-600 mt-1">
              {stats.inTransitTotal} equipos × {fmt(stats.avgRevenuePerUnit)} promedio
            </p>
          </div>
          <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                Sell-Through
              </span>
              <TrendingUp className="w-4 h-4 text-violet-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {stats.sellThroughRate?.toFixed(0) ?? '—'}%
            </p>
            <p className="text-xs text-violet-600 mt-1">Del inventario total vendido</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                En tránsito
              </span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{stats.inTransitTotal ?? '—'}</p>
            <p className="text-xs text-amber-600 mt-1">Equipos camino a SV</p>
          </div>
        </div>
      )}

      {/* BI Row: Brand margin analysis + Repair impact */}
      {isAdminOrGerente && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top marcas por ingresos */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm">Top Marcas por Ingresos</h3>
              <p className="text-xs text-gray-400">Ventas totales por marca ({periodShort})</p>
            </div>
            {stats.brandRevenueAnalysis.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">Sin ventas en el período</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {stats.brandRevenueAnalysis.map((b, i) => {
                  const maxRev = stats.brandRevenueAnalysis[0].revenue;
                  const pct = maxRev > 0 ? (b.revenue / maxRev) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-xs text-gray-400 w-4 font-bold">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{b.marca}</p>
                        <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900">{fmt(b.revenue)}</p>
                        <p className="text-xs text-gray-400">
                          {b.units} uds · {fmt(b.avgRevenue)} avg
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Impacto reparaciones + Capital en tránsito */}
          <div className="space-y-4">
            {/* Repair cost impact */}
            <RepairCostCard repairCostImpact={stats.repairCostImpact} />

            {/* Pipeline de capital */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                Pipeline de equipos
              </p>
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2 text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 shrink-0" />
                    En tránsito a SV
                  </span>
                  <span className="font-bold text-gray-900">{stats.inTransitTotal} uds</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="flex items-center gap-2 text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                    En inventario SV
                  </span>
                  <span className="font-bold text-gray-900">
                    {stats.inStock + stats.reserved} uds
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-2 mt-1">
                  <span className="font-semibold text-gray-700">Total en pipeline</span>
                  <span className="font-bold text-indigo-700">
                    {stats.inTransitTotal + stats.inStock + stats.reserved} uds
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Lotes + Velocidad por Modelo */}
      {isAdminOrGerente &&
        (stats.topLoteRevenue?.length > 0 || stats.modelVelocity?.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Lotes por Ingresos */}
            {stats.topLoteRevenue && stats.topLoteRevenue.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 text-sm">Top Lotes por Ingresos</h3>
                  <p className="text-xs text-gray-400">Envíos más rentables · {periodShort}</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {stats.topLoteRevenue.map((lote, i) => {
                    const maxRev = stats.topLoteRevenue![0].revenue;
                    const pct = maxRev > 0 ? (lote.revenue / maxRev) * 100 : 0;
                    return (
                      <div key={i} className="flex items-center gap-3 px-5 py-3">
                        <span className="text-xs text-gray-400 w-4 font-bold">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-700 truncate">
                            {lote.lote}
                          </p>
                          <div className="mt-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-gray-900">{fmt(lote.revenue)}</p>
                          <p className="text-xs text-gray-400">{lote.units} uds</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Velocidad por modelo */}
            {stats.modelVelocity && stats.modelVelocity.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 text-sm">Velocidad de Venta</h3>
                  <p className="text-xs text-gray-400">Días promedio para vender por modelo</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {stats.modelVelocity.map((m, i) => {
                    const color =
                      m.avgDays <= 15
                        ? 'text-emerald-600 bg-emerald-50'
                        : m.avgDays <= 30
                          ? 'text-amber-600 bg-amber-50'
                          : 'text-red-600 bg-red-50';
                    return (
                      <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                        <span className="text-xs text-gray-400 w-4 font-bold">{i + 1}</span>
                        <p className="flex-1 text-xs font-medium text-gray-700 truncate">
                          {m.modelo}
                        </p>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-400">{m.units} uds</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>
                            {m.avgDays}d
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      {/* Bottom row: Top models + Recent activity */}
      {isAdminOrGerente && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top 5 Modelos este mes */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Top Modelos</h3>
                <p className="text-xs text-gray-400">Por ingresos ({periodShort})</p>
              </div>
              <Link to="/finanzas" className="text-xs text-primary-600 hover:underline font-medium">
                Ver más →
              </Link>
            </div>
            {stats.topModels.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">Sin ventas en el período</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {stats.topModels.map((m, i) => {
                  // Use top model's revenue as 100% so bars are proportional within the list
                  const maxRev = stats.topModels[0]?.revenue || 1;
                  const pct = (m.revenue / maxRev) * 100;
                  return (
                    <div key={i} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-xs text-gray-400 w-4 font-bold">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{m.modelo}</p>
                        <div className="mt-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-gray-900">{fmt(m.revenue)}</p>
                        <p className="text-xs text-gray-400">{m.count} uds</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actividad reciente */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Últimas ventas</h3>
                <p className="text-xs text-gray-400">5 más recientes</p>
              </div>
              <Link to="/ventas" className="text-xs text-primary-600 hover:underline font-medium">
                Ver todas →
              </Link>
            </div>
            {stats.recentSales.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">Sin ventas registradas</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {stats.recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                      <Smartphone className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{sale.modelo}</p>
                      <p className="text-xs text-gray-400">{fmtDate(sale.fecha)}</p>
                    </div>
                    <p className="text-sm font-bold text-emerald-600 shrink-0">
                      {fmt(sale.precio)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comprador: CTA de catálogo */}
      {userRole === 'comprador' ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
          <p className="text-sm text-gray-500 font-medium mb-1">
            {stats.inStock} equipos disponibles para ordenar
          </p>
          <Link
            to="/catalogo"
            className="inline-flex items-center gap-2 mt-3 px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors text-sm shadow-sm"
          >
            Explorar Catálogo →
          </Link>
        </div>
      ) : !isAdminOrGerente ? (
        /* Vendedor: solo stock + taller */
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs text-gray-500 font-medium mb-1">En Taller</p>
            <p className="text-3xl font-bold text-orange-600">{stats.inWorkshop}</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs text-gray-500 font-medium mb-1">Apartados</p>
            <p className="text-3xl font-bold text-yellow-600">{stats.reserved}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Taller view ──────────────────────────────────────────────────────────────

function TallerView() {
  const { stats, isLoading } = useDashboardStats();

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-2xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="bg-yellow-50 border border-yellow-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2 text-yellow-700">
          <Clock className="w-4 h-4" />
          <span className="text-xs font-medium">Por recibir</span>
        </div>
        <p className="text-3xl font-bold text-yellow-900">{stats.pendingReception}</p>
      </div>
      <div className="bg-pink-50 border border-pink-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2 text-pink-700">
          <PenTool className="w-4 h-4" />
          <span className="text-xs font-medium">En reparación</span>
        </div>
        <p className="text-3xl font-bold text-pink-900">{stats.inRepair}</p>
      </div>
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2 text-indigo-700">
          <AlertCircle className="w-4 h-4" />
          <span className="text-xs font-medium">Para gerencia</span>
        </div>
        <p className="text-3xl font-bold text-indigo-900">{stats.pendingManagementReception}</p>
      </div>
      <div className="bg-gray-100 border border-gray-200 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2 text-gray-600">
          <PenTool className="w-4 h-4" />
          <span className="text-xs font-medium">Total proceso</span>
        </div>
        <p className="text-3xl font-bold text-gray-900">{stats.inWorkshop}</p>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  trend,
  icon,
  color,
  hidden = false,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: number | null;
  icon: React.ReactNode;
  color: 'blue' | 'emerald' | 'purple' | 'red' | 'orange';
  hidden?: boolean;
}) {
  if (hidden) return null;

  const iconColors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    purple: 'bg-purple-100 text-purple-600',
    red: 'bg-red-100 text-red-600',
    orange: 'bg-orange-100 text-orange-600',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${iconColors[color]}`}
        >
          {icon}
        </div>
        {trend !== undefined && trend !== null && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}
          >
            {trend >= 0 ? (
              <ArrowUpRight className="w-3.5 h-3.5" />
            ) : (
              <ArrowDownRight className="w-3.5 h-3.5" />
            )}
            {Math.abs(trend).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900 leading-none">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-2 leading-snug">{sub}</p>}
    </div>
  );
}

function NavCard({
  to,
  icon,
  bg,
  label,
  sub,
  highlight = false,
}: {
  to: string;
  icon: React.ReactNode;
  bg: string;
  label: string;
  sub: string;
  highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all p-4 flex items-center gap-3 group ${highlight ? 'border-emerald-200' : 'border-gray-100'}`}
    >
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${bg} group-hover:scale-110 transition-transform`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-semibold text-gray-900 text-sm truncate">{label}</p>
        <p className="text-xs text-gray-400 truncate">{sub}</p>
      </div>
    </Link>
  );
}
