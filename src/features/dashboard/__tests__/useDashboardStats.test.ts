import { describe, it, expect } from 'vitest';

// We cannot easily test the hook itself without a full QueryClient + Firestore mock setup.
// Instead, we extract and test the pure computation function `computeSoldMetrics` by
// importing the module internals. Since computeSoldMetrics is NOT exported, we test the
// helper functions it depends on (normalizeDisplayBrand, normalizeIPhoneModel, phoneLabel)
// in phoneUtils.test.ts, and here we test the period calculation logic and round2.

// Test the round2 helper and period date logic that the hook uses

describe('Dashboard Stats — Pure Logic', () => {
  const round2 = (n: number) => Math.round(n * 100) / 100;

  describe('round2', () => {
    it('rounds to 2 decimal places', () => {
      expect(round2(1.005)).toBe(1); // JS floating point: Math.round(100.5) = 100
      expect(round2(1.555)).toBe(1.56);
      expect(round2(0)).toBe(0);
      expect(round2(100)).toBe(100);
      expect(round2(99.999)).toBe(100);
      expect(round2(1.1 + 2.2)).toBe(3.3);
    });
  });

  describe('Period date calculations', () => {
    it('3m period: monthStart is 3 months ago', () => {
      const now = new Date('2026-03-17T12:00:00Z');
      const monthsBack = 3;
      const monthStart = new Date(now);
      monthStart.setMonth(monthStart.getMonth() - monthsBack);
      monthStart.setHours(0, 0, 0, 0);

      // December 17, 2025 at midnight
      expect(monthStart.getMonth()).toBe(11); // December = 11
      expect(monthStart.getFullYear()).toBe(2025);
    });

    it('6m period: monthStart is 6 months ago', () => {
      const now = new Date('2026-03-17T12:00:00Z');
      const monthsBack = 6;
      const monthStart = new Date(now);
      monthStart.setMonth(monthStart.getMonth() - monthsBack);
      monthStart.setHours(0, 0, 0, 0);

      // September 17, 2025
      expect(monthStart.getMonth()).toBe(8); // September = 8
      expect(monthStart.getFullYear()).toBe(2025);
    });

    it('1y period: monthStart is 12 months ago', () => {
      const now = new Date('2026-03-17T12:00:00Z');
      const monthsBack = 12;
      const monthStart = new Date(now);
      monthStart.setMonth(monthStart.getMonth() - monthsBack);
      monthStart.setHours(0, 0, 0, 0);

      // March 17, 2025
      expect(monthStart.getMonth()).toBe(2); // March = 2
      expect(monthStart.getFullYear()).toBe(2025);
    });

    it('previous period ends 1 second before current period starts', () => {
      const now = new Date('2026-03-17T12:00:00Z');
      const monthsBack = 3;
      const monthStart = new Date(now);
      monthStart.setMonth(monthStart.getMonth() - monthsBack);
      monthStart.setHours(0, 0, 0, 0);

      const lastMonthEnd = new Date(monthStart);
      lastMonthEnd.setSeconds(lastMonthEnd.getSeconds() - 1);

      // Should be 1 second before monthStart
      expect(lastMonthEnd.getTime()).toBe(monthStart.getTime() - 1000);
    });

    it('previous period start is same duration before current period start', () => {
      const now = new Date('2026-03-17T12:00:00Z');
      const monthsBack = 3;
      const monthStart = new Date(now);
      monthStart.setMonth(monthStart.getMonth() - monthsBack);
      monthStart.setHours(0, 0, 0, 0);

      const lastMonthStart = new Date(monthStart);
      lastMonthStart.setMonth(lastMonthStart.getMonth() - monthsBack);

      // For 3m: previous period starts 6 months ago from now
      expect(lastMonthStart.getMonth()).toBe(8); // September = 8
      expect(lastMonthStart.getFullYear()).toBe(2025);
    });
  });

  describe('Revenue change calculation', () => {
    it('calculates positive revenue change', () => {
      const thisRevenue = 15000;
      const lastRevenue = 10000;
      const changePct = round2(((thisRevenue - lastRevenue) / lastRevenue) * 100);
      expect(changePct).toBe(50);
    });

    it('calculates negative revenue change', () => {
      const thisRevenue = 8000;
      const lastRevenue = 10000;
      const changePct = round2(((thisRevenue - lastRevenue) / lastRevenue) * 100);
      expect(changePct).toBe(-20);
    });

    it('returns null when previous period revenue is 0', () => {
      const lastRevenue = 0;
      const changePct =
        lastRevenue > 0 ? round2(((10000 - lastRevenue) / lastRevenue) * 100) : null;
      expect(changePct).toBeNull();
    });
  });

  describe('Sell-through rate calculation', () => {
    it('calculates sell-through correctly', () => {
      const unitsSold = 30;
      const totalInventory = 70;
      const rate = round2((unitsSold / (unitsSold + totalInventory)) * 100);
      expect(rate).toBe(30);
    });

    it('returns 0 when no inventory and no sales', () => {
      const unitsSold = 0;
      const totalInventory = 0;
      const rate = round2(
        totalInventory > 0 ? (unitsSold / (unitsSold + totalInventory)) * 100 : 0
      );
      expect(rate).toBe(0);
    });

    it('returns 100% when all inventory was sold and nothing remains', () => {
      const unitsSold = 50;
      const totalInventory = 0;
      const rate = round2((unitsSold / (unitsSold + totalInventory)) * 100);
      expect(rate).toBe(100);
    });
  });

  describe('Average days to sell calculation', () => {
    it('computes avg days from fechaIngreso to fechaVenta', () => {
      const phones = [
        { fechaIngreso: '2026-01-01', fechaVenta: '2026-01-11' }, // 10 days
        { fechaIngreso: '2026-01-01', fechaVenta: '2026-01-21' }, // 20 days
      ];

      function toMs(val: unknown): number {
        if (!val) return NaN;
        if (
          typeof val === 'object' &&
          val !== null &&
          typeof (val as { toDate?: () => Date }).toDate === 'function'
        ) {
          return (val as { toDate: () => Date }).toDate().getTime();
        }
        if (typeof val === 'string') return new Date(val).getTime();
        return NaN;
      }

      const validDays: number[] = [];
      phones.forEach((p) => {
        const days = (toMs(p.fechaVenta) - toMs(p.fechaIngreso)) / (1000 * 60 * 60 * 24);
        if (!isNaN(days) && days >= 0) validDays.push(days);
      });

      const avg = round2(validDays.reduce((s, d) => s + d, 0) / validDays.length);
      expect(avg).toBe(15);
    });

    it('excludes phones where ingreso > venta (negative days)', () => {
      const phones = [
        { fechaIngreso: '2026-02-01', fechaVenta: '2026-01-01' }, // -31 days, excluded
        { fechaIngreso: '2026-01-01', fechaVenta: '2026-01-11' }, // 10 days
      ];

      function toMs(val: unknown): number {
        if (typeof val === 'string') return new Date(val).getTime();
        return NaN;
      }

      const validDays: number[] = [];
      phones.forEach((p) => {
        const days = (toMs(p.fechaVenta) - toMs(p.fechaIngreso)) / (1000 * 60 * 60 * 24);
        if (!isNaN(days) && days >= 0) validDays.push(days);
      });

      expect(validDays).toHaveLength(1);
      expect(round2(validDays[0])).toBe(10);
    });

    it('handles Firestore Timestamp objects via toDate()', () => {
      const mockTimestamp = {
        toDate: () => new Date('2026-01-01'),
      };

      function toMs(val: unknown): number {
        if (!val) return NaN;
        if (
          typeof val === 'object' &&
          val !== null &&
          typeof (val as { toDate?: () => Date }).toDate === 'function'
        ) {
          return (val as { toDate: () => Date }).toDate().getTime();
        }
        if (typeof val === 'string') return new Date(val).getTime();
        return NaN;
      }

      expect(toMs(mockTimestamp)).toBe(new Date('2026-01-01').getTime());
    });
  });

  describe('seized phone filtering', () => {
    it('excludes seized phones from inStock count', () => {
      const phones = [
        { estado: 'En Stock (Disponible para Venta)', seized: false },
        { estado: 'En Stock (Disponible para Venta)', seized: true },
        { estado: 'En Stock (Disponible para Venta)' },
      ];
      const filtered = phones.filter((p) => !p.seized);
      expect(filtered).toHaveLength(2);
    });

    it('counts seized phones separately', () => {
      const phones = [
        { seized: true, seizedReason: 'CECOT' },
        { seized: true, seizedReason: 'Aduana' },
        { estado: 'En Stock (Disponible para Venta)' },
      ];
      const seizedCount = phones.filter((p) => p.seized).length;
      expect(seizedCount).toBe(2);
    });
  });

  describe('Workshop debt / repair cost impact', () => {
    it('sums unpaid repair costs', () => {
      const phones = [
        {
          reparaciones: [
            { cost: 25, paid: false },
            { cost: 15, paid: true }, // paid, excluded
            { cost: 30, paid: false },
          ],
        },
        {
          reparaciones: [{ cost: 10, paid: false }],
        },
        { reparaciones: [] }, // no repairs
      ];

      const repairCostImpact = round2(
        phones.reduce((total, phone) => {
          const unpaid = (phone.reparaciones || [])
            .filter((r) => !r.paid && r.cost > 0)
            .reduce((s, r) => s + r.cost, 0);
          return total + unpaid;
        }, 0)
      );

      expect(repairCostImpact).toBe(65); // 25 + 30 + 10
    });
  });
});
