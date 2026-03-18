import { useQuery } from '@tanstack/react-query';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getCountFromServer,
  getAggregateFromServer,
  sum,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Phone } from '../../../types';
import { phoneLabel, normalizeDisplayBrand, normalizeIPhoneModel } from '../../../lib/phoneUtils';

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── Aggregate counts (1 Firestore read, 0 data downloaded) ───────────────────
async function getPhoneCount(estadoFilter: string | string[]): Promise<number> {
  const coll = collection(db, 'phones');
  const q = Array.isArray(estadoFilter)
    ? query(coll, where('estado', 'in', estadoFilter))
    : query(coll, where('estado', '==', estadoFilter));
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

// ── Capital sum (1 Firestore read, 0 data downloaded) ────────────────────────
async function getSumCosto(estados: string[]): Promise<number> {
  const q = query(collection(db, 'phones'), where('estado', 'in', estados));
  const snap = await getAggregateFromServer(q, { total: sum('costo') });
  return round2(snap.data().total || 0);
}

// ── Sold phones in a date range (bounded, max 500 docs) ──────────────────────
async function getSoldPhonesInRange(start: Date, end: Date): Promise<Phone[]> {
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  const q = query(
    collection(db, 'phones'),
    where('fechaVenta', '>=', startStr),
    where('fechaVenta', '<=', endStr),
    orderBy('fechaVenta', 'desc'),
    limit(500)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Phone);
}

// ── Transit count: only 'En Tránsito (a El Salvador)' ───────────────────────
// 'En Bodega (USA)' is excluded — that state is the app's default for admin, so it's
// contaminated with hundreds of legacy phones that were never properly updated.
// We only count phones explicitly marked as "En Tránsito".
// fechaIngreso is stored as ISO string in some phones and Timestamp in others, so we
// use a string cutoff for the inequality filter to cover the ISO-string case.
async function getRecentTransitCount(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const q = query(
    collection(db, 'phones'),
    where('estado', '==', 'En Tránsito (a El Salvador)'),
    where('fechaIngreso', '>=', cutoffStr)
  );
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

// ── Stale stock: phones in stock > 30 days ───────────────────────────────────
// fechaIngreso can be ISO string OR Firestore Timestamp depending on how the phone was added.
// Use ISO string cutoff to correctly filter string-type fechaIngreso values.
async function getStaleStockCount(): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const q = query(
    collection(db, 'phones'),
    where('estado', '==', 'En Stock (Disponible para Venta)'),
    where('fechaIngreso', '<=', cutoffStr)
  );
  const snap = await getCountFromServer(q);
  return snap.data().count;
}

// ── Recent 5 sales ────────────────────────────────────────────────────────────
async function getRecentSales() {
  const q = query(
    collection(db, 'phones'),
    where('estado', 'in', [
      'Vendido',
      'Pagado',
      'Entregado al Cliente',
      'Vendido (Pendiente de Entrega)',
    ]),
    orderBy('fechaVenta', 'desc'),
    limit(5)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => {
      const data = d.data();
      if (!data.fechaVenta) return null;
      return {
        id: d.id,
        modelo: phoneLabel(data.marca, data.modelo),
        precio: data.precioVenta || 0,
        fecha: new Date(data.fechaVenta),
      };
    })
    .filter(Boolean) as { id: string; modelo: string; precio: number; fecha: Date }[];
}

// ── Client-side analytics from already-loaded sold phones ────────────────────
function computeSoldMetrics(sold: Phone[]) {
  const totalRevenue = round2(sold.reduce((s, p) => s + (p.precioVenta || 0), 0));
  // NOTE: costo is not tracked here — Eduardo doesn't enter purchase costs.
  // All margin/profit metrics are excluded to avoid misleading 100% margin figures.

  // Helper: convert fechaIngreso (Firestore Timestamp object) or fechaVenta (ISO string) → ms
  function toMs(val: unknown): number {
    if (!val) return NaN;
    // Firestore Timestamp object
    if (
      typeof val === 'object' &&
      val !== null &&
      typeof (val as { toDate?: () => Date }).toDate === 'function'
    ) {
      return (val as { toDate: () => Date }).toDate().getTime();
    }
    // ISO string
    if (typeof val === 'string') return new Date(val).getTime();
    return NaN;
  }

  // Average days to sell — only count phones with valid, non-negative day count.
  // Phones with ingreso > venta or missing dates are excluded from both numerator AND denominator
  // to avoid artificially deflating the average.
  const validDays: number[] = [];
  sold.forEach((p) => {
    if (!p.fechaIngreso || !p.fechaVenta) return;
    const days = (toMs(p.fechaVenta) - toMs(p.fechaIngreso)) / (1000 * 60 * 60 * 24);
    if (!isNaN(days) && days >= 0) validDays.push(days);
  });
  const avgDaysToSell =
    validDays.length > 0 ? round2(validDays.reduce((s, d) => s + d, 0) / validDays.length) : 0;

  // Unpaid repair costs on phones sold this month (eats into real margin)
  const repairCostImpact = round2(
    sold.reduce((total, phone) => {
      const unpaid = (phone.reparaciones || [])
        .filter((r) => !r.paid && r.cost > 0)
        .reduce((s, r) => s + r.cost, 0);
      return total + unpaid;
    }, 0)
  );

  // Brand analysis: top brands by revenue (no margin — costo not entered by Eduardo)
  const brandMap = new Map<string, { units: number; revenue: number }>();
  sold.forEach((p) => {
    const key = normalizeDisplayBrand(p.marca);
    const prev = brandMap.get(key) || { units: 0, revenue: 0 };
    brandMap.set(key, {
      units: prev.units + 1,
      revenue: prev.revenue + (p.precioVenta || 0),
    });
  });
  const brandRevenueAnalysis = [...brandMap.entries()]
    .map(([marca, d]) => ({
      marca,
      units: d.units,
      revenue: round2(d.revenue),
      avgRevenue: round2(d.units > 0 ? d.revenue / d.units : 0),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);

  // Top models: normalize brand + normalize model string for consistent deduplication.
  // e.g. "14 PRO MAX 128GB" and "14 pro max 128gb" both → "14 Pro Max 128GB"
  // "Apple 14 Pro Max 128GB" → "14 Pro Max 128GB" (strips redundant brand prefix)
  const modelMap = new Map<
    string,
    { marca: string; modelo: string; count: number; revenue: number }
  >();
  sold.forEach((p) => {
    const normalizedMarca = normalizeDisplayBrand(p.marca);
    const rawLabel = phoneLabel(p.marca, p.modelo);
    const normalizedModelo =
      normalizedMarca === 'Apple' ? normalizeIPhoneModel(rawLabel) || rawLabel : rawLabel;
    const key = `${normalizedMarca}|${normalizedModelo}`;
    const existing = modelMap.get(key);
    if (existing) {
      existing.count += 1;
      existing.revenue += p.precioVenta || 0;
    } else {
      modelMap.set(key, {
        marca: normalizedMarca,
        modelo: normalizedModelo,
        count: 1,
        revenue: p.precioVenta || 0,
      });
    }
  });
  const topModels = [...modelMap.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Workshop debt from unpaid repairs on sold phones
  const workshopDebt = repairCostImpact;

  // Per-model velocity: avg days from ingreso to venta, using Timestamp-aware conversion
  const modelVelocityMap = new Map<string, { days: number[]; units: number }>();
  sold.forEach((p) => {
    if (!p.fechaIngreso || !p.fechaVenta) return;
    const ingresoMs = toMs(p.fechaIngreso);
    const ventaMs = toMs(p.fechaVenta);
    const days = (ventaMs - ingresoMs) / (1000 * 60 * 60 * 24);
    if (isNaN(days) || days < 0) return;

    const normalizedMarca = normalizeDisplayBrand(p.marca);
    const normalizedModelo =
      normalizedMarca === 'Apple'
        ? normalizeIPhoneModel(phoneLabel(p.marca, p.modelo)) || phoneLabel(p.marca, p.modelo)
        : phoneLabel(p.marca, p.modelo);
    const key = `${normalizedMarca}|${normalizedModelo}`;

    const prev = modelVelocityMap.get(key) || { days: [], units: 0 };
    prev.days.push(days);
    prev.units += 1;
    modelVelocityMap.set(key, prev);
  });

  const modelVelocity = [...modelVelocityMap.entries()]
    .filter(([, d]) => d.units >= 2 && d.days.length >= 2)
    .map(([key, d]) => {
      const [marca, modelo] = key.split('|');
      const avgDays = round2(d.days.reduce((a, b) => a + b, 0) / d.days.length);
      return { marca, modelo, units: d.units, avgDays };
    })
    .sort((a, b) => a.avgDays - b.avgDays) // fastest first
    .slice(0, 8);

  return {
    monthRevenue: totalRevenue,
    monthUnitsSold: sold.length,
    avgDaysToSell,
    repairCostImpact,
    brandRevenueAnalysis,
    topModels,
    workshopDebt,
    modelVelocity,
  };
}

// ── Total client debt (aggregate, 0 documents downloaded) ────────────────────
async function getTotalClientDebt(): Promise<number> {
  const snap = await getAggregateFromServer(collection(db, 'clients'), {
    total: sum('debtAmount'),
  });
  return round2(snap.data().total || 0);
}

export type DashboardPeriod = '3m' | '6m' | '1y';

// ── Main query ────────────────────────────────────────────────────────────────
function useOptimizedDashboardData(period: DashboardPeriod = '3m') {
  return useQuery({
    queryKey: ['dashboard-stats', period],
    queryFn: async () => {
      const now = new Date();

      // Current period start
      const monthsBack = period === '3m' ? 3 : period === '6m' ? 6 : 12;
      const monthStart = new Date(now);
      monthStart.setMonth(monthStart.getMonth() - monthsBack);
      monthStart.setHours(0, 0, 0, 0);

      // Previous period (same length, immediately before current)
      const lastMonthStart = new Date(monthStart);
      lastMonthStart.setMonth(lastMonthStart.getMonth() - monthsBack);
      const lastMonthEnd = new Date(monthStart);
      lastMonthEnd.setSeconds(lastMonthEnd.getSeconds() - 1);

      const [
        inStock,
        reserved,
        inRepair,
        pendingReception,
        pendingMgmtReception,
        staleStock,
        thisMonthSold,
        lastMonthSold,
        recentSales,
        capitalEnInventario,
        capitalEnTransito,
        totalClientDebt,
        inTransitTotal,
      ] = await Promise.all([
        getPhoneCount('En Stock (Disponible para Venta)').catch(() => 0),
        getPhoneCount('Apartado').catch(() => 0),
        getPhoneCount('En Taller (Recibido)').catch(() => 0),
        getPhoneCount(['Enviado a Taller (Externo)', 'Enviado a Taller (Garantía)']).catch(() => 0),
        getPhoneCount('Enviado a Gerencia (Pendiente)').catch(() => 0),
        getStaleStockCount().catch(() => 0),
        getSoldPhonesInRange(monthStart, now).catch(() => [] as Phone[]),
        getSoldPhonesInRange(lastMonthStart, lastMonthEnd).catch(() => [] as Phone[]),
        getRecentSales().catch(() => []),
        getSumCosto([
          'En Stock (Disponible para Venta)',
          'Apartado',
          'En Taller (Recibido)',
          'Recibido de Taller (OK)',
          'Enviado a Gerencia (Pendiente)',
          'Enviado a Gerencia',
        ]).catch(() => 0),
        getSumCosto(['En Bodega (USA)', 'En Tránsito (a El Salvador)']).catch(() => 0),
        getTotalClientDebt().catch(() => 0),
        getRecentTransitCount().catch(() => 0),
      ]);

      // Seized phones count (separate query — Firestore can't combine != with in on different fields)
      const seizedQuery = query(collection(db, 'phones'), where('seized', '==', true));
      const seizedSnap = await getCountFromServer(seizedQuery);
      const seizedCount = seizedSnap.data().count;

      const thisMetrics = computeSoldMetrics(thisMonthSold);
      const lastMetrics = computeSoldMetrics(lastMonthSold);

      const revenueChangePct =
        lastMetrics.monthRevenue > 0
          ? round2(
              ((thisMetrics.monthRevenue - lastMetrics.monthRevenue) / lastMetrics.monthRevenue) *
                100
            )
          : null;

      // ── New metrics ──────────────────────────────────────────────────────────

      // 1. monthlyRevenueTrend — bucket ventas por mes dentro del período seleccionado
      const monthlyRevenueTrend: Array<{ month: string; revenue: number; units: number }> = [];
      const bucketCount = monthsBack; // 3, 6 or 12
      for (let i = bucketCount - 1; i >= 0; i--) {
        const bucketDate = new Date(now);
        bucketDate.setMonth(bucketDate.getMonth() - i);
        const monthKey = `${bucketDate.getFullYear()}-${String(bucketDate.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = bucketDate.toLocaleDateString('es-SV', {
          month: 'short',
          year: '2-digit',
        });

        const monthPhones = thisMonthSold.filter((p) => {
          const fv = typeof p.fechaVenta === 'string' ? p.fechaVenta : '';
          return fv.startsWith(monthKey);
        });

        monthlyRevenueTrend.push({
          month: monthLabel,
          revenue: round2(monthPhones.reduce((s, p) => s + (p.precioVenta || 0), 0)),
          units: monthPhones.length,
        });
      }

      // 2. topLoteRevenue — top 6 lotes por ingresos
      const loteMap = new Map<string, { revenue: number; units: number }>();
      thisMonthSold.forEach((p) => {
        const lote = (p.lote || 'Sin lote').trim();
        const prev = loteMap.get(lote) || { revenue: 0, units: 0 };
        loteMap.set(lote, {
          revenue: prev.revenue + (p.precioVenta || 0),
          units: prev.units + 1,
        });
      });
      const topLoteRevenue = [...loteMap.entries()]
        .map(([lote, d]) => ({ lote, revenue: round2(d.revenue), units: d.units }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 6);

      // 3. avgRevenuePerUnit + projectedTransitRevenue
      const avgRevenuePerUnit =
        thisMetrics.monthUnitsSold > 0
          ? round2(thisMetrics.monthRevenue / thisMetrics.monthUnitsSold)
          : 538; // historical fallback

      const projectedTransitRevenue = round2(inTransitTotal * avgRevenuePerUnit);

      // 4. sellThroughRate
      const totalInventory =
        inStock + reserved + inRepair + pendingReception + pendingMgmtReception + inTransitTotal;
      const sellThroughRate = round2(
        totalInventory > 0
          ? (thisMetrics.monthUnitsSold / (thisMetrics.monthUnitsSold + totalInventory)) * 100
          : 0
      );

      return {
        // Status counts
        inStock,
        reserved,
        inRepair,
        pendingReception,
        pendingManagementReception: pendingMgmtReception,
        staleStock,
        // Revenue (all based on precioVenta — no cost/margin since Eduardo doesn't enter costs)
        monthRevenue: thisMetrics.monthRevenue,
        monthUnitsSold: thisMetrics.monthUnitsSold,
        revenueChangePct,
        workshopDebt: thisMetrics.workshopDebt,
        // BI metrics
        avgDaysToSell: thisMetrics.avgDaysToSell,
        repairCostImpact: thisMetrics.repairCostImpact,
        capitalEnInventario, // always ~$0 until Eduardo enters costs; kept for future use
        capitalEnTransito, // always ~$0 until Eduardo enters costs; kept for future use
        brandRevenueAnalysis: thisMetrics.brandRevenueAnalysis,
        // Charts
        topModels: thisMetrics.topModels,
        recentSales,
        // Debt (aggregate, no full collection download)
        totalClientDebt,
        // Legacy aliases
        totalRevenue: thisMetrics.monthRevenue,
        inWorkshop: inRepair,
        // New dashboard metrics
        monthlyRevenueTrend,
        topLoteRevenue,
        avgRevenuePerUnit,
        projectedTransitRevenue,
        sellThroughRate,
        inTransitTotal,
        modelVelocity: thisMetrics.modelVelocity,
        seizedCount,
      };
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useDashboardStats(period: DashboardPeriod = '3m') {
  const { data: stats, isLoading } = useOptimizedDashboardData(period);

  return { isLoading, stats: stats ?? null };
}
