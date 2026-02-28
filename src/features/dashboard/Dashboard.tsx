import { useMemo } from 'react';
import { usePhones } from '../inventory/hooks/usePhones';
import MetricCard from '../../components/ui/MetricCard';
import GlassCard from '../../components/ui/GlassCard';
import { DollarSign, Smartphone, Wrench, TrendingUp, AlertCircle } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// Static mock chart data generated once at module load (outside component to satisfy react-hooks/purity)
const STATIC_CHART_DATA = Array.from({ length: 10 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() - (9 - i) * 3);
  return {
    date: format(d, 'dd MMM', { locale: es }),
    revenue: Math.floor(Math.random() * 2000) + 500,
    profit: Math.floor(Math.random() * 800) + 200,
  };
});

export default function Dashboard() {
  const { data: phones = [] } = usePhones();

  // --- Derived Stats (Memoized for performance) ---
  const stats = useMemo(() => {
    // 1. Basic Counts
    const available = phones.filter((p) => p.estado === 'En Stock (Disponible para Venta)');
    const sold = phones.filter(
      (p) => p.estado && (p.estado.includes('Vendido') || p.estado === 'Pagado')
    );
    const inWorkshop = phones.filter((p) => p.estado && p.estado.includes('Taller'));

    // 2. Financials
    const totalRevenue = sold.reduce((sum, p) => sum + (p.precioVenta || 0), 0);
    const totalCost = sold.reduce((sum, p) => sum + (p.costo || 0), 0);
    const grossProfit = totalRevenue - totalCost;
    const itemsSold = sold.length;

    // 3. Trends (Mocked for now, but structure is ready for real historical data)
    // We would typically filter `phones` by date to get "last month" vs "this month"
    const mockTrendRevenue = 12.5;
    const mockTrendProfit = 8.2;

    // 5. Pie Chart Data (Inventory by Brand)
    const brandCounts: Record<string, number> = {};
    available.forEach((p) => {
      brandCounts[p.marca] = (brandCounts[p.marca] || 0) + 1;
    });
    const pieData = Object.entries(brandCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5 brands

    return {
      availableCount: available.length,
      itemsSold,
      inWorkshopCount: inWorkshop.length,
      totalRevenue,
      grossProfit,
      mockTrendRevenue,
      mockTrendProfit,
      chartData: STATIC_CHART_DATA,
      pieData,
    };
  }, [phones]);

  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6'];

  return (
    <div className="space-y-8 animate-fade-in p-2">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 mt-1">Visión general del negocio en tiempo real.</p>
        </div>
        <div className="text-sm text-slate-400">Actualizado: {new Date().toLocaleTimeString()}</div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Ingresos Totales"
          value={`$${stats.totalRevenue.toLocaleString()}`}
          trend={stats.mockTrendRevenue}
          icon={<DollarSign className="w-6 h-6" />}
          color="blue"
          delay={0.1}
          chartData={stats.chartData.map((d) => ({ value: d.revenue }))}
        />
        <MetricCard
          title="Ganancia Neta"
          value={`$${stats.grossProfit.toLocaleString()}`}
          trend={stats.mockTrendProfit}
          icon={<TrendingUp className="w-6 h-6" />}
          color="emerald"
          delay={0.2}
          chartData={stats.chartData.map((d) => ({ value: d.profit }))}
        />
        <MetricCard
          title="En Stock"
          value={stats.availableCount}
          icon={<Smartphone className="w-6 h-6" />}
          color="amber"
          delay={0.3}
        />
        <MetricCard
          title="En Taller"
          value={stats.inWorkshopCount}
          icon={<Wrench className="w-6 h-6" />}
          color="rose"
          delay={0.4}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Sales Chart */}
        <GlassCard className="lg:col-span-2 p-6 h-[400px] flex flex-col" hoverEffect delay={0.5}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-800">Tendencia de Ventas (30 Días)</h3>
            <select className="text-sm border-none bg-slate-50 rounded-lg py-1 px-3 text-slate-500 focus:ring-0 cursor-pointer">
              <option>Últimos 30 días</option>
              <option>Este Año</option>
            </select>
          </div>
          <div className="flex-1 w-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="date"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#0ea5e9"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  name="Ingresos"
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorProfit)"
                  name="Ganancia"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Inventory Distribution */}
        <GlassCard className="p-6 h-[400px] flex flex-col" hoverEffect delay={0.6}>
          <h3 className="text-lg font-bold text-slate-800 mb-6">Inventario por Marca</h3>
          <div className="flex-1 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.pieData}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  cornerRadius={6}
                >
                  {stats.pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center Text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none pb-8">
              <span className="text-2xl font-bold text-slate-700">{stats.availableCount}</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Alerts / Action Center */}
      <GlassCard className="p-6 bg-rose-50 border-rose-100" delay={0.7}>
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-rose-500" />
          <h3 className="text-lg font-bold text-rose-900">Atención Requerida</h3>
        </div>
        <div className="space-y-3">
          {stats.inWorkshopCount > 5 && (
            <div className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
              <span className="text-sm font-medium text-slate-700">
                ⚠️ Hay {stats.inWorkshopCount} equipos en taller. Revisar tiempos de entrega.
              </span>
              <button className="text-xs font-bold text-rose-600 hover:underline">
                Ver Taller
              </button>
            </div>
          )}
          {/* Placeholder for more logical alerts */}
          <div className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm opacity-60">
            <span className="text-sm font-medium text-slate-700">
              ✅ Todo lo demás parece estar en orden.
            </span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
