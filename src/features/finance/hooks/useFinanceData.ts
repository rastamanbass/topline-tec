import { useMemo } from 'react';
import { usePhones } from '../../inventory/hooks/usePhones';
import { useClients } from '../../clients/hooks/useClients';

export interface DateRange {
  start: Date;
  end: Date;
}

export interface FinanceSummary {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  unitsSold: number;
  avgOrderValue: number;
  totalDebt: number;
  totalCredit: number;
}

export interface ModelStat {
  modelo: string;
  marca: string;
  count: number;
  revenue: number;
  profit: number;
  margin: number;
}

export interface LotStat {
  lote: string;
  unitsBought: number;
  unitsSold: number;
  cogs: number;
  revenue: number;
  profit: number;
  margin: number;
  unsoldStock: number;
}

export interface ClientStat {
  clientId: string;
  name: string;
  totalPurchases: number;
  totalDebt: number;
}

export function useFinanceData(range: DateRange) {
  const { data: phones = [], isLoading: phonesLoading } = usePhones();
  const { data: clients = [], isLoading: clientsLoading } = useClients();

  const isLoading = phonesLoading || clientsLoading;

  const data = useMemo(() => {
    if (!phones.length) return null;

    const rangeStart = range.start.getTime();
    const rangeEnd = range.end.getTime();

    // Phones sold in the selected range
    const soldPhones = phones.filter((p) => {
      const isSold =
        p.estado === 'Vendido' ||
        p.estado === 'Pagado' ||
        p.estado?.includes('Vendido') ||
        p.estado === 'Entregado al Cliente';

      if (!isSold) return false;

      // Use fechaVenta if available, otherwise fechaIngreso as fallback
      const saleDate = p.fechaVenta ? new Date(p.fechaVenta).getTime() : null;
      if (!saleDate) return false;

      return saleDate >= rangeStart && saleDate <= rangeEnd;
    });

    // Summary
    const revenue = soldPhones.reduce((s, p) => s + (p.precioVenta || 0), 0);
    const cogs = soldPhones.reduce((s, p) => s + (p.costo || 0), 0);
    const grossProfit = revenue - cogs;
    const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
    const unitsSold = soldPhones.length;
    const avgOrderValue = unitsSold > 0 ? revenue / unitsSold : 0;

    const totalDebt = clients.reduce((s, c) => s + (c.debtAmount || 0), 0);
    const totalCredit = clients.reduce((s, c) => s + (c.creditAmount || 0), 0);

    const summary: FinanceSummary = {
      revenue,
      cogs,
      grossProfit,
      grossMarginPct,
      unitsSold,
      avgOrderValue,
      totalDebt,
      totalCredit,
    };

    // Top models by revenue
    const modelMap = new Map<string, ModelStat>();
    soldPhones.forEach((p) => {
      const key = `${p.marca}-${p.modelo}`;
      const existing = modelMap.get(key);
      const profit = (p.precioVenta || 0) - (p.costo || 0);
      if (existing) {
        existing.count += 1;
        existing.revenue += p.precioVenta || 0;
        existing.profit += profit;
        existing.margin = existing.revenue > 0 ? (existing.profit / existing.revenue) * 100 : 0;
      } else {
        modelMap.set(key, {
          modelo: p.modelo,
          marca: p.marca,
          count: 1,
          revenue: p.precioVenta || 0,
          profit,
          margin: (p.precioVenta || 0) > 0 ? (profit / (p.precioVenta || 0)) * 100 : 0,
        });
      }
    });
    const topModels = [...modelMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // Lot P&L
    const lotMap = new Map<string, LotStat>();
    phones.forEach((p) => {
      const lote = p.lote || 'Sin Lote';
      const existing = lotMap.get(lote);
      const isSoldInRange = soldPhones.some((s) => s.id === p.id);

      if (existing) {
        existing.unitsBought += 1;
        if (isSoldInRange) {
          existing.unitsSold += 1;
          existing.cogs += p.costo || 0;
          existing.revenue += p.precioVenta || 0;
          existing.profit = existing.revenue - existing.cogs;
          existing.margin = existing.revenue > 0 ? (existing.profit / existing.revenue) * 100 : 0;
        }
        if (p.estado === 'En Stock (Disponible para Venta)') existing.unsoldStock += 1;
      } else {
        lotMap.set(lote, {
          lote,
          unitsBought: 1,
          unitsSold: isSoldInRange ? 1 : 0,
          cogs: isSoldInRange ? p.costo || 0 : 0,
          revenue: isSoldInRange ? p.precioVenta || 0 : 0,
          profit: isSoldInRange ? (p.precioVenta || 0) - (p.costo || 0) : 0,
          margin: 0,
          unsoldStock: p.estado === 'En Stock (Disponible para Venta)' ? 1 : 0,
        });
      }
    });
    const lotStats = [...lotMap.values()].sort((a, b) => b.revenue - a.revenue);

    // Top clients by debt
    const topDebtors: ClientStat[] = clients
      .filter((c) => (c.debtAmount || 0) > 0)
      .sort((a, b) => b.debtAmount - a.debtAmount)
      .slice(0, 10)
      .map((c) => ({
        clientId: c.id,
        name: c.name,
        totalPurchases: 0,
        totalDebt: c.debtAmount,
      }));

    return { summary, topModels, lotStats, topDebtors };
  }, [phones, clients, range]);

  return { data, isLoading };
}

export function getPresetRange(preset: 'today' | 'week' | 'month' | 'quarter' | 'year'): DateRange {
  const now = new Date();
  const start = new Date();

  switch (preset) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'quarter':
      start.setMonth(Math.floor(now.getMonth() / 3) * 3, 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'year':
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
  }

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}
