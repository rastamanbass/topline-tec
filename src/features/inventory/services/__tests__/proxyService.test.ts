import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase before importing anything that depends on it
vi.mock('../../../../lib/firebase', () => ({
  db: {},
  functions: {},
}));

// Mock firebase/functions
const mockHttpsCallable = vi.fn();
vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => mockHttpsCallable(...args),
}));

// Mock deviceService
const mockSaveDeviceDefinition = vi.fn();
const mockFindByTacInPhones = vi.fn();
vi.mock('../deviceService', () => ({
  saveDeviceDefinition: (...args: unknown[]) => mockSaveDeviceDefinition(...args),
  findByTacInPhones: (...args: unknown[]) => mockFindByTacInPhones(...args),
}));

// Mock tacCatalog with a small subset
vi.mock('../../../../data/tacCatalog', () => ({
  TAC_DATABASE: {
    '35637110': { brand: 'Apple', model: 'iPhone 15 Pro Max' },
    '35105981': { brand: 'Samsung', model: 'Galaxy S23 Plus 256gb' },
  } as Record<string, { brand: string; model: string }>,
}));

import { fetchDeviceFromProxy } from '../proxyService';

describe('proxyService — TAC lookup cascade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByTacInPhones.mockResolvedValue(null);
  });

  // ── Step 1: Offline TAC DB ──────────────────────────────────────────────────

  it('returns brand/model from offline TAC DB for known TAC', async () => {
    const result = await fetchDeviceFromProxy('356371101234567');

    expect(result).toEqual({ brand: 'Apple', model: 'iPhone 15 Pro Max' });
    expect(mockSaveDeviceDefinition).toHaveBeenCalledWith(
      '35637110',
      'Apple',
      'iPhone 15 Pro Max'
    );
    // Should NOT fall through to inventory or cloud function
    expect(mockFindByTacInPhones).not.toHaveBeenCalled();
    expect(mockHttpsCallable).not.toHaveBeenCalled();
  });

  it('returns Samsung from offline DB for known Samsung TAC', async () => {
    const result = await fetchDeviceFromProxy('351059811234567');

    expect(result).toEqual({ brand: 'Samsung', model: 'Galaxy S23 Plus 256gb' });
    expect(mockSaveDeviceDefinition).toHaveBeenCalledWith(
      '35105981',
      'Samsung',
      'Galaxy S23 Plus 256gb'
    );
  });

  // ── GS1 normalization ───────────────────────────────────────────────────────

  it('strips leading "1" from 16-digit GS1-128 barcode', async () => {
    // 16 digits starting with '1' → strip to 15, then extract TAC from first 8
    const gs1Barcode = '1356371101234567'; // 16 digits, leading '1'
    const result = await fetchDeviceFromProxy(gs1Barcode);

    expect(result).toEqual({ brand: 'Apple', model: 'iPhone 15 Pro Max' });
    expect(mockSaveDeviceDefinition).toHaveBeenCalledWith(
      '35637110',
      'Apple',
      'iPhone 15 Pro Max'
    );
  });

  it('does NOT strip leading "1" from a regular 15-digit IMEI', async () => {
    // 15 digits starting with '1' — should NOT strip (only strips if 16 digits)
    const imei15 = '100000001234567'; // TAC = '10000000' (not in DB)
    const result = await fetchDeviceFromProxy(imei15);

    // TAC '10000000' not in offline DB, falls through
    expect(mockFindByTacInPhones).toHaveBeenCalledWith('10000000');
  });

  it('strips non-digit characters from IMEI input', async () => {
    const messyInput = '35-6371-10-1234567';
    const result = await fetchDeviceFromProxy(messyInput);

    expect(result).toEqual({ brand: 'Apple', model: 'iPhone 15 Pro Max' });
  });

  // ── Step 2: Inventory fallback ──────────────────────────────────────────────

  it('falls through to findByTacInPhones when TAC not in offline DB', async () => {
    const unknownTac = '99999999';
    mockFindByTacInPhones.mockResolvedValue({ brand: 'Xiaomi', model: 'Redmi Note 12' });

    const result = await fetchDeviceFromProxy(unknownTac + '1234567');

    expect(mockFindByTacInPhones).toHaveBeenCalledWith(unknownTac);
    expect(result).toEqual({ brand: 'Xiaomi', model: 'Redmi Note 12' });
    expect(mockSaveDeviceDefinition).toHaveBeenCalledWith(unknownTac, 'Xiaomi', 'Redmi Note 12');
  });

  // ── Step 3: Cloud Function fallback ─────────────────────────────────────────

  it('falls through to Cloud Function when both offline DB and inventory miss', async () => {
    const unknownTac = '88888888';
    mockFindByTacInPhones.mockResolvedValue(null);

    const mockCallable = vi.fn().mockResolvedValue({
      data: { brand: 'Huawei', model: 'P60 Pro' },
    });
    mockHttpsCallable.mockReturnValue(mockCallable);

    const result = await fetchDeviceFromProxy(unknownTac + '1234567');

    expect(mockFindByTacInPhones).toHaveBeenCalledWith(unknownTac);
    expect(mockHttpsCallable).toHaveBeenCalled();
    expect(mockCallable).toHaveBeenCalledWith({ tac: unknownTac });
    expect(result).toEqual({ brand: 'Huawei', model: 'P60 Pro' });
    expect(mockSaveDeviceDefinition).toHaveBeenCalledWith(unknownTac, 'Huawei', 'P60 Pro');
  });

  it('returns null when all three sources miss', async () => {
    const unknownTac = '77777777';
    mockFindByTacInPhones.mockResolvedValue(null);

    const mockCallable = vi.fn().mockResolvedValue({ data: null });
    mockHttpsCallable.mockReturnValue(mockCallable);

    const result = await fetchDeviceFromProxy(unknownTac + '1234567');

    expect(result).toBeNull();
  });

  it('returns null when Cloud Function throws (silent fail)', async () => {
    const unknownTac = '66666666';
    mockFindByTacInPhones.mockResolvedValue(null);

    const mockCallable = vi.fn().mockRejectedValue(new Error('Network error'));
    mockHttpsCallable.mockReturnValue(mockCallable);

    const result = await fetchDeviceFromProxy(unknownTac + '1234567');

    expect(result).toBeNull();
  });
});
