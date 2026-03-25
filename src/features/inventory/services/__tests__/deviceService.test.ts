import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Firestore
const mockGetDoc = vi.fn();
const mockSetDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockWriteBatch = vi.fn();
const mockDoc = vi.fn((_db, _coll, id) => ({ id, path: `${_coll}/${id}` }));
const mockCollection = vi.fn((_db, name) => ({ name }));
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockLimit = vi.fn();

vi.mock('../../../../lib/firebase', () => ({
  db: {},
}));

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => mockDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (...args: unknown[]) => mockWhere(...args),
  limit: (...args: unknown[]) => mockLimit(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}));

import {
  getDeviceDefinition,
  saveDeviceDefinition,
  seedDeviceDefinitions,
  findByTacInPhones,
} from '../deviceService';

describe('deviceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  // ── getDeviceDefinition ─────────────────────────────────────────────────────

  describe('getDeviceDefinition', () => {
    it('returns null for empty TAC', async () => {
      expect(await getDeviceDefinition('')).toBeNull();
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it('returns null for TAC shorter than 8 chars', async () => {
      expect(await getDeviceDefinition('1234567')).toBeNull();
      expect(mockGetDoc).not.toHaveBeenCalled();
    });

    it('returns device definition for valid TAC', async () => {
      const mockData = { brand: 'Apple', model: 'iPhone 15', updatedAt: 1700000000 };
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => mockData,
      });

      const result = await getDeviceDefinition('35637110');

      expect(result).toEqual(mockData);
      expect(mockDoc).toHaveBeenCalledWith({}, 'device_definitions', '35637110');
    });

    it('returns null when document does not exist', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => false,
      });

      const result = await getDeviceDefinition('99999999');
      expect(result).toBeNull();
    });

    it('returns null on Firestore error', async () => {
      mockGetDoc.mockRejectedValue(new Error('Firestore unavailable'));

      const result = await getDeviceDefinition('35637110');
      expect(result).toBeNull();
    });
  });

  // ── saveDeviceDefinition ────────────────────────────────────────────────────

  describe('saveDeviceDefinition', () => {
    it('does not write for empty TAC', async () => {
      await saveDeviceDefinition('', 'Apple', 'iPhone 15');
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('does not write for short TAC (< 8)', async () => {
      await saveDeviceDefinition('1234', 'Apple', 'iPhone 15');
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('does not write for empty brand', async () => {
      await saveDeviceDefinition('35637110', '', 'iPhone 15');
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('does not write for empty model', async () => {
      await saveDeviceDefinition('35637110', 'Apple', '');
      expect(mockSetDoc).not.toHaveBeenCalled();
    });

    it('writes with merge for valid inputs', async () => {
      mockSetDoc.mockResolvedValue(undefined);

      await saveDeviceDefinition('35637110', 'Apple', 'iPhone 15 Pro Max');

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(), // docRef
        expect.objectContaining({
          brand: 'Apple',
          model: 'iPhone 15 Pro Max',
          updatedAt: expect.any(Number),
        }),
        { merge: true }
      );
    });

    it('silently handles Firestore errors', async () => {
      mockSetDoc.mockRejectedValue(new Error('Permission denied'));

      // Should not throw
      await expect(saveDeviceDefinition('35637110', 'Apple', 'iPhone 15')).resolves.toBeUndefined();
    });
  });

  // ── seedDeviceDefinitions ───────────────────────────────────────────────────

  describe('seedDeviceDefinitions', () => {
    it('returns 0 for empty inventory', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] });

      const count = await seedDeviceDefinitions();
      expect(count).toBe(0);
    });

    it('extracts TAC from phone IMEIs and batches writes', async () => {
      const mockBatch = {
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      mockWriteBatch.mockReturnValue(mockBatch);

      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ imei: '356371101234567', marca: 'Apple', modelo: 'iPhone 15 Pro Max' }) },
          { data: () => ({ imei: '351059811234567', marca: 'Samsung', modelo: 'Galaxy S23 Plus' }) },
          // Same TAC as first — should be deduplicated
          { data: () => ({ imei: '356371109876543', marca: 'Apple', modelo: 'iPhone 15 Pro Max' }) },
        ],
      });

      const count = await seedDeviceDefinitions();

      expect(count).toBe(2); // Deduplicated by TAC
      expect(mockBatch.set).toHaveBeenCalledTimes(2);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });

    it('skips phones missing imei, marca, or modelo', async () => {
      const mockBatch = {
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      mockWriteBatch.mockReturnValue(mockBatch);

      mockGetDocs.mockResolvedValue({
        docs: [
          { data: () => ({ imei: '', marca: 'Apple', modelo: 'iPhone 15' }) },       // no imei
          { data: () => ({ imei: '351059811234567', marca: '', modelo: 'Galaxy' }) },  // no marca
          { data: () => ({ imei: '351059811234567', marca: 'Samsung', modelo: '' }) }, // no modelo
          { data: () => ({ imei: '356371101234567', marca: 'Apple', modelo: 'iPhone 15' }) }, // valid
        ],
      });

      const count = await seedDeviceDefinitions();
      expect(count).toBe(1);
    });

    it('normalizes GS1 16-digit IMEIs before extracting TAC', async () => {
      const mockBatch = {
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      mockWriteBatch.mockReturnValue(mockBatch);

      mockGetDocs.mockResolvedValue({
        docs: [
          // 16 digits starting with '1' → strip to 15 → TAC = '35637110'
          { data: () => ({ imei: '1356371101234567', marca: 'Apple', modelo: 'iPhone 15' }) },
        ],
      });

      const count = await seedDeviceDefinitions();
      expect(count).toBe(1);
      // The TAC should be '35637110' after GS1 normalization
      expect(mockDoc).toHaveBeenCalledWith(
        expect.anything(),
        'device_definitions',
        '35637110'
      );
    });

    it('batches in groups of 500', async () => {
      const mockBatch = {
        set: vi.fn(),
        commit: vi.fn().mockResolvedValue(undefined),
      };
      mockWriteBatch.mockReturnValue(mockBatch);

      // Create 501 unique phones (each with unique TAC)
      const docs = Array.from({ length: 501 }, (_, i) => ({
        data: () => ({
          imei: `${String(10000000 + i)}1234567`,
          marca: 'Apple',
          modelo: `Model ${i}`,
        }),
      }));

      mockGetDocs.mockResolvedValue({ docs });

      const count = await seedDeviceDefinitions();
      expect(count).toBe(501);
      // Should commit in 2 batches: 500 + 1
      expect(mockBatch.commit).toHaveBeenCalledTimes(2);
    });
  });

  // ── findByTacInPhones ───────────────────────────────────────────────────────

  describe('findByTacInPhones', () => {
    it('returns device definition when phone with matching TAC prefix exists', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{ data: () => ({ marca: 'Apple', modelo: 'iPhone 14 Pro' }) }],
      });

      const result = await findByTacInPhones('35637110');

      expect(result).toEqual(
        expect.objectContaining({ brand: 'Apple', model: 'iPhone 14 Pro' })
      );
    });

    it('returns null when no matching phone found', async () => {
      mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

      const result = await findByTacInPhones('99999999');
      expect(result).toBeNull();
    });

    it('returns null when phone has no marca/modelo', async () => {
      mockGetDocs.mockResolvedValue({
        empty: false,
        docs: [{ data: () => ({ marca: '', modelo: '' }) }],
      });

      const result = await findByTacInPhones('35637110');
      expect(result).toBeNull();
    });

    it('returns null on Firestore error', async () => {
      mockGetDocs.mockRejectedValue(new Error('Firestore error'));

      const result = await findByTacInPhones('35637110');
      expect(result).toBeNull();
    });
  });
});
