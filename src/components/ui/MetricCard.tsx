import { type ReactNode } from 'react';
import GlassCard from './GlassCard';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: number; // percent change
  icon?: ReactNode;
  color?: 'blue' | 'emerald' | 'rose' | 'amber';
  chartData?: { value: number }[]; // Minimal data for sparkline
  delay?: number;
}

const COLORS = {
  blue: '#3b82f6',
  emerald: '#10b981',
  rose: '#f43f5e',
  amber: '#f59e0b',
};

export default function MetricCard({
  title,
  value,
  trend,
  icon,
  color = 'blue',
  chartData,
  delay,
}: MetricCardProps) {
  const isPositive = trend && trend > 0;
  const isNeutral = trend === 0;
  const trendColor = isPositive
    ? 'text-emerald-600'
    : isNeutral
      ? 'text-gray-500'
      : 'text-rose-600';
  const TrendIcon = isPositive ? ArrowUpRight : isNeutral ? Minus : ArrowDownRight;

  return (
    <GlassCard
      className="relative p-6 flex flex-col justify-between h-36"
      hoverEffect
      delay={delay}
    >
      {/* Background Decoration */}
      <div
        className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 blur-2xl flex items-center justify-center`}
        style={{ backgroundColor: COLORS[color] }}
      ></div>

      <div className="flex justify-between items-start z-10">
        <div>
          <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-800 tracking-tight">{value}</span>
          </div>
        </div>
        {icon && (
          <div className={`p-3 rounded-xl bg-${color}-50 text-${color}-600 shadow-sm`}>{icon}</div>
        )}
      </div>

      <div className="flex justify-between items-end mt-2 z-10">
        {trend !== undefined && (
          <div
            className={`flex items-center text-sm font-semibold ${trendColor} bg-white/50 px-2 py-1 rounded-lg backdrop-blur-sm self-end`}
          >
            <TrendIcon className="w-4 h-4 mr-1" />
            {Math.abs(trend)}%
            <span className="ml-1 text-slate-400 font-normal">vs mes anterior</span>
          </div>
        )}

        {/* Sparkline Chart */}
        {chartData && (
          <div className="w-24 h-12 ml-auto opacity-75">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={COLORS[color]}
                  fill={COLORS[color]}
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
