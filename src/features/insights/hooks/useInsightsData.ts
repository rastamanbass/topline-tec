import { useMemo } from 'react';
import { usePhones } from '../../inventory/hooks/usePhones';
import { useClients } from '../../clients/hooks/useClients';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AgingPhone {
  id: string;
  imei: string;
  marca: string;
  modelo: string;
  storage?: string;
  precioVenta: number;
  days: number;
}

export interface AgingBucket {
  key: 'fast' | 'normal' | 'slow' | 'critical';
  label: string;
  color: 'emerald' | 'blue' | 'orange' | 'red';
  count: number;
  phones: AgingPhone[];
}

export interface LotVelocityStat {
  lote: string;
  total: number;
  sold: number;
  inStock: number;
  sellThroughPct: number;
  avgDaysToSell: number | null;
}

export interface ClientRiskStat {
  clientId: string;
  name: string;
  debtAmount: number;
  creditAmount: number;
  utilizationPct: number;
  riskLevel: 'high' | 'medium' | 'low';
}

export interface RepairBurdenStat {
  model: string;
  repairCount: number;
  phonesAffected: number;
  totalRepairCost: number;
  avgCostPerRepair: number;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useInsightsData() {
  const { data: phones = [], isLoading: phonesLoading } = usePhones();
  const { data: clients = [], isLoading: clientsLoading } = useClients();

  const isLoading = phonesLoading || clientsLoading;

  const data = useMemo(() => {
    const now = Date.now();

    // ── PANEL 1: Inventory aging ───────────────────────────────────────────
    const stockPhones = phones.filter(
      (p) => p.estado === 'En Stock (Disponible para Venta)'
    );

    const bucketMap: Record<AgingBucket['key'], AgingPhone[]> = {
      fast: [],
      normal: [],
      slow: [],
      critical: [],
    };

    stockPhones.forEach((p) => {
      const days = Math.floor(
        (now - new Date(p.fechaIngreso).getTime()) / 86_400_000
      );
      const item: AgingPhone = {
        id: p.id,
        imei: p.imei,
        marca: p.marca,
        modelo: p.modelo,
        storage: p.storage,
        precioVenta: p.precioVenta,
        days,
      };
      if (days <= 15) bucketMap.fast.push(item);
      else if (days <= 30) bucketMap.normal.push(item);
      else if (days <= 60) bucketMap.slow.push(item);
      else bucketMap.critical.push(item);
    });

    // Sort each bucket: oldest first
    Object.values(bucketMap).forEach((arr) =>
      arr.sort((a, b) => b.days - a.days)
    );

    const agingBuckets: AgingBucket[] = [
      { key: 'fast', label: '0–15 días', color: 'emerald', count: bucketMap.fast.length, phones: bucketMap.fast },
      { key: 'normal', label: '16–30 días', color: 'blue', count: bucketMap.normal.length, phones: bucketMap.normal },
      { key: 'slow', label: '31–60 días', color: 'orange', count: bucketMap.slow.length, phones: bucketMap.slow },
      { key: 'critical', label: '60+ días', color: 'red', count: bucketMap.critical.length, phones: bucketMap.critical },
    ];

    // ── PANEL 2: Lot velocity ─────────────────────────────────────────────
    const isSold = (estado: string | undefined) =>
      !!estado &&
      (estado.includes('Vendido') ||
        estado === 'Pagado' ||
        estado === 'Entregado al Cliente');

    const lotMap = new Map<string, {
      total: number;
      sold: number;
      inStock: number;
      daysToSellList: number[];
    }>();

    phones.forEach((p) => {
      const lote = p.lote || 'Sin Lote';
      if (!lotMap.has(lote)) {
        lotMap.set(lote, { total: 0, sold: 0, inStock: 0, daysToSellList: [] });
      }
      const entry = lotMap.get(lote)!;
      entry.total += 1;

      if (isSold(p.estado)) {
        entry.sold += 1;
        if (p.fechaIngreso && p.fechaVenta) {
          const days = Math.max(
            0,
            (new Date(p.fechaVenta).getTime() - new Date(p.fechaIngreso).getTime()) /
              86_400_000
          );
          if (!isNaN(days)) entry.daysToSellList.push(days);
        }
      } else if (p.estado === 'En Stock (Disponible para Venta)') {
        entry.inStock += 1;
      }
    });

    const lotVelocity: LotVelocityStat[] = [...lotMap.entries()]
      .map(([lote, e]) => ({
        lote,
        total: e.total,
        sold: e.sold,
        inStock: e.inStock,
        sellThroughPct: e.total > 0 ? (e.sold / e.total) * 100 : 0,
        avgDaysToSell:
          e.daysToSellList.length > 0
            ? Math.round(
                e.daysToSellList.reduce((s, d) => s + d, 0) /
                  e.daysToSellList.length
              )
            : null,
      }))
      .sort((a, b) => a.sellThroughPct - b.sellThroughPct)
      .slice(0, 10);

    // ── PANEL 3: Client credit risk ───────────────────────────────────────
    const clientRisk: ClientRiskStat[] = clients
      .filter((c) => (c.debtAmount || 0) > 0)
      .map((c) => {
        const debt = c.debtAmount || 0;
        const credit = c.creditAmount || 0;
        const utilizationPct =
          debt + credit > 0 ? (debt / (debt + credit)) * 100 : 100;
        const riskLevel: ClientRiskStat['riskLevel'] =
          utilizationPct > 75 || debt > 500
            ? 'high'
            : utilizationPct > 40
              ? 'medium'
              : 'low';
        return {
          clientId: c.id,
          name: c.name,
          debtAmount: debt,
          creditAmount: credit,
          utilizationPct,
          riskLevel,
        };
      })
      .sort((a, b) => b.debtAmount - a.debtAmount)
      .slice(0, 10);

    // ── PANEL 4: Repair burden by model ──────────────────────────────────
    const repairMap = new Map<string, {
      repairCount: number;
      phonesAffected: number;
      totalRepairCost: number;
    }>();

    phones.forEach((p) => {
      const repairs = p.reparaciones || [];
      if (repairs.length === 0) return;
      const key = `${p.marca} ${p.modelo}`.trim();
      if (!repairMap.has(key)) {
        repairMap.set(key, { repairCount: 0, phonesAffected: 0, totalRepairCost: 0 });
      }
      const entry = repairMap.get(key)!;
      entry.phonesAffected += 1;
      repairs.forEach((r) => {
        entry.repairCount += 1;
        entry.totalRepairCost += r.cost || 0;
      });
    });

    const repairBurden: RepairBurdenStat[] = [...repairMap.entries()]
      .map(([model, e]) => ({
        model,
        repairCount: e.repairCount,
        phonesAffected: e.phonesAffected,
        totalRepairCost: e.totalRepairCost,
        avgCostPerRepair:
          e.repairCount > 0 ? e.totalRepairCost / e.repairCount : 0,
      }))
      .sort((a, b) => b.totalRepairCost - a.totalRepairCost)
      .slice(0, 8);

    return { agingBuckets, lotVelocity, clientRisk, repairBurden };
  }, [phones, clients]);

  return { ...data, isLoading };
}
