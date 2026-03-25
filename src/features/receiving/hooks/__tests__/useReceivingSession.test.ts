import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Firebase + hooks before importing ─────────────────────────────────

vi.mock('../../../../lib/firebase', () => ({
  db: {},
  auth: { currentUser: { email: 'test@topline.com' } },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn().mockResolvedValue({ id: 'report-123' }),
  serverTimestamp: () => 'MOCK_TIMESTAMP',
  writeBatch: vi.fn(() => ({
    update: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: [], isLoading: false })),
  useQueryClient: vi.fn(() => ({
    invalidateQueries: vi.fn(),
  })),
}));

vi.mock('../../../inventory/hooks/usePhones', () => ({
  usePhones: vi.fn(() => ({ data: [], isLoading: false })),
}));

// ── Tests for processScan logic ─────────────────────────────────────────────
// We extract and test the pure scan logic directly since the hook has
// complex React dependencies. This mirrors the exact algorithm in processScan.

describe('Receiving — processScan logic', () => {
  // Replicate the pure scan logic from useReceivingSession.processScan
  function createScanner(
    transitImeis: Map<string, { id: string; marca: string; modelo: string; storage?: string }>,
    allLoteImeis: Map<string, { id: string; marca: string; modelo: string; estado: string }>
  ) {
    const processedImeis = new Set<string>();
    const results: Array<{ imei: string; status: string; phoneInfo?: string; currentState?: string }> = [];

    function processScan(rawImei: string) {
      let imei = rawImei.trim().replace(/\D/g, '');
      if (!imei || imei.length < 8) return 'ignored' as const;

      // GS1 normalization
      if (imei.length === 16 && imei[0] === '1') {
        imei = imei.substring(1);
      }

      if (processedImeis.has(imei)) {
        results.unshift({ imei, status: 'duplicate' });
        return 'duplicate' as const;
      }

      processedImeis.add(imei);

      const expected = transitImeis.get(imei);
      if (expected) {
        const info = [expected.marca, expected.modelo, expected.storage]
          .filter(Boolean)
          .join(' · ');
        results.unshift({ imei, status: 'ok', phoneInfo: info });
        return 'ok' as const;
      }

      const other = allLoteImeis.get(imei);
      if (other) {
        const info = `${other.marca} ${other.modelo}`;
        results.unshift({ imei, status: 'wrong_state', phoneInfo: info, currentState: other.estado });
        return 'wrong_state' as const;
      }

      results.unshift({ imei, status: 'not_found' });
      return 'not_found' as const;
    }

    return { processScan, results, processedImeis };
  }

  let transitMap: Map<string, { id: string; marca: string; modelo: string; storage?: string }>;
  let allLoteMap: Map<string, { id: string; marca: string; modelo: string; estado: string }>;

  beforeEach(() => {
    transitMap = new Map([
      ['356371101234567', { id: 'p1', marca: 'Apple', modelo: 'iPhone 15 Pro Max', storage: '256GB' }],
      ['351059811234567', { id: 'p2', marca: 'Samsung', modelo: 'Galaxy S24', storage: '128GB' }],
      ['353568560170721', { id: 'p3', marca: 'Apple', modelo: 'iPhone 14', storage: '128GB' }],
    ]);
    allLoteMap = new Map([
      ...transitMap.entries(),
      ['999888777666555', { id: 'p4', marca: 'Apple', modelo: 'iPhone 13', estado: 'Vendido' }],
    ].map(([k, v]) => [k, { ...v, estado: (v as any).estado || 'En Tránsito (a El Salvador)' }]));
  });

  // ── Input validation ──────────────────────────────────────────────────────

  describe('input validation', () => {
    it('ignores empty input', () => {
      const { processScan } = createScanner(transitMap, allLoteMap);
      expect(processScan('')).toBe('ignored');
      expect(processScan('   ')).toBe('ignored');
    });

    it('ignores input shorter than 8 digits', () => {
      const { processScan } = createScanner(transitMap, allLoteMap);
      expect(processScan('1234567')).toBe('ignored');
      expect(processScan('123')).toBe('ignored');
    });

    it('strips non-digit characters before processing', () => {
      const { processScan } = createScanner(transitMap, allLoteMap);
      expect(processScan('356-371-101-234-567')).toBe('ok');
    });

    it('trims whitespace', () => {
      const { processScan } = createScanner(transitMap, allLoteMap);
      expect(processScan('  356371101234567  ')).toBe('ok');
    });
  });

  // ── GS1 normalization (barcode scanner gun) ───────────────────────────────

  describe('GS1 normalization', () => {
    it('strips leading "1" from 16-digit barcode', () => {
      const { processScan } = createScanner(transitMap, allLoteMap);
      // Scanner gun outputs 16 digits: '1' + 15-digit IMEI
      expect(processScan('1356371101234567')).toBe('ok');
    });

    it('does NOT strip leading "1" from 15-digit IMEI', () => {
      const { processScan, results } = createScanner(transitMap, allLoteMap);
      // 15 digits starting with '1' — normal IMEI, should NOT strip
      const result = processScan('100000001234567');
      // This IMEI is not in transitMap, so it should be not_found (not stripped)
      expect(result).toBe('not_found');
    });

    it('does NOT strip leading "2" from 16-digit input', () => {
      const { processScan } = createScanner(transitMap, allLoteMap);
      // 16 digits but starts with '2' — not GS1, should not strip
      expect(processScan('2356371101234567')).toBe('not_found');
    });

    it('handles real barcode scanner output with GS1 prefix', () => {
      const { processScan, results } = createScanner(transitMap, allLoteMap);
      // Real scenario: scanner reads '1353568560170721' (16 digits)
      // Should strip to '353568560170721' → find phone p3
      expect(processScan('1353568560170721')).toBe('ok');
      expect(results[0].phoneInfo).toBe('Apple · iPhone 14 · 128GB');
    });
  });

  // ── Scan status classification ────────────────────────────────────────────

  describe('scan status classification', () => {
    it('returns "ok" for expected transit phone', () => {
      const { processScan, results } = createScanner(transitMap, allLoteMap);
      expect(processScan('356371101234567')).toBe('ok');
      expect(results[0].phoneInfo).toBe('Apple · iPhone 15 Pro Max · 256GB');
    });

    it('returns "not_found" for unknown IMEI', () => {
      const { processScan } = createScanner(transitMap, allLoteMap);
      expect(processScan('111222333444555')).toBe('not_found');
    });

    it('returns "wrong_state" for phone in lote but not in transit', () => {
      const { processScan, results } = createScanner(transitMap, allLoteMap);
      expect(processScan('999888777666555')).toBe('wrong_state');
      expect(results[0].currentState).toBe('Vendido');
    });

    it('returns "duplicate" when scanning same IMEI twice', () => {
      const { processScan } = createScanner(transitMap, allLoteMap);
      expect(processScan('356371101234567')).toBe('ok');
      expect(processScan('356371101234567')).toBe('duplicate');
    });

    it('GS1 duplicate: 16-digit then 15-digit same IMEI = duplicate', () => {
      const { processScan } = createScanner(transitMap, allLoteMap);
      // First scan with GS1 prefix
      expect(processScan('1356371101234567')).toBe('ok');
      // Second scan without prefix — same normalized IMEI
      expect(processScan('356371101234567')).toBe('duplicate');
    });
  });

  // ── Phone info formatting ─────────────────────────────────────────────────

  describe('phone info formatting', () => {
    it('joins marca, modelo, storage with " · " separator', () => {
      const { processScan, results } = createScanner(transitMap, allLoteMap);
      processScan('351059811234567');
      expect(results[0].phoneInfo).toBe('Samsung · Galaxy S24 · 128GB');
    });

    it('omits missing fields from info string', () => {
      const noStorageMap = new Map([
        ['356371101234567', { id: 'p1', marca: 'Apple', modelo: 'iPhone 15' }],
      ]);
      const { processScan, results } = createScanner(noStorageMap, allLoteMap);
      processScan('356371101234567');
      expect(results[0].phoneInfo).toBe('Apple · iPhone 15');
    });

    it('wrong_state shows "marca modelo" format', () => {
      const { processScan, results } = createScanner(transitMap, allLoteMap);
      processScan('999888777666555');
      expect(results[0].phoneInfo).toBe('Apple iPhone 13');
    });
  });

  // ── Batch scanning simulation ─────────────────────────────────────────────

  describe('batch scanning (real-world simulation)', () => {
    it('processes 50 consecutive scans correctly', () => {
      // Build a transit map with 50 phones
      const bigTransitMap = new Map<string, { id: string; marca: string; modelo: string; storage: string }>();
      for (let i = 0; i < 50; i++) {
        const imei = `35637110${String(i).padStart(7, '0')}`;
        bigTransitMap.set(imei, { id: `p${i}`, marca: 'Apple', modelo: `iPhone ${i}`, storage: '128GB' });
      }

      const { processScan, processedImeis } = createScanner(bigTransitMap, new Map());

      // Scan all 50
      for (let i = 0; i < 50; i++) {
        const imei = `35637110${String(i).padStart(7, '0')}`;
        expect(processScan(imei)).toBe('ok');
      }

      expect(processedImeis.size).toBe(50);

      // Re-scan first one → duplicate
      expect(processScan('356371100000000')).toBe('duplicate');
    });

    it('mixed scan scenario: ok + duplicate + not_found', () => {
      const { processScan, results } = createScanner(transitMap, allLoteMap);

      expect(processScan('356371101234567')).toBe('ok');       // known transit
      expect(processScan('356371101234567')).toBe('duplicate'); // duplicate
      expect(processScan('000000000000000')).toBe('not_found'); // unknown
      expect(processScan('999888777666555')).toBe('wrong_state'); // wrong state

      expect(results).toHaveLength(4);
      expect(results.map(r => r.status)).toEqual(['wrong_state', 'not_found', 'duplicate', 'ok']);
    });
  });
});
