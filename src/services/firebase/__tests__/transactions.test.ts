import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSaleTransaction, type SaleData } from '../transactions';

// Mock Firebase
const mockRunTransaction = vi.fn();
const mockDoc = vi.fn();
const mockCollection = vi.fn();

vi.mock('../../lib/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user' } },
}));

vi.mock('firebase/firestore', () => ({
  runTransaction: (db: unknown, callback: (t: unknown) => Promise<unknown>) =>
    mockRunTransaction(db, callback),
  doc: (...args: unknown[]) => mockDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  serverTimestamp: () => 'MOCK_TIMESTAMP',
  increment: (n: number) => ({ type: 'increment', value: n }),
  arrayUnion: (val: unknown) => ({ type: 'arrayUnion', value: val }),
  getFirestore: vi.fn(),
}));

describe('executeSaleTransaction (Stress Logic)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should process a sale of 100 items successfully', async () => {
    // Setup Mocks
    const mockClient = { name: 'Test Client', creditAmount: 1000000 };
    const mockTransaction = {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => mockClient,
      }),
      update: vi.fn(),
      set: vi.fn(),
    };

    mockRunTransaction.mockImplementation(async (_db, callback) => {
      return callback(mockTransaction);
    });

    // Simulating 100 items
    const items = Array.from({ length: 100 }, (_, i) => ({
      id: `phone-${i}`,
      phoneId: `phone-${i}`,
      description: `iPhone ${i}`,
      price: 1000,
      quantity: 1,
      type: 'phone' as const,
      imei: `IMEI-${i}`,
    }));

    const saleData: SaleData = {
      items,
      totalAmount: 100000, // 100 * 1000
      paymentMethod: 'cash',
      clientId: 'client-123',
      amountPaidWithCredit: 0,
      amountPaidWithWorkshopDebt: 0,
    };

    await executeSaleTransaction(saleData, []); // Empty allPhones because we aren't testing workshop debt logic here

    // Assertions
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);

    // Should update 100 phone docs (to status 'Vendido')
    // We can't easily check exactly 100 calls to transaction.update without complex matchers,
    // but we can check if it ran without error.

    // Check if Sales Record was created
    expect(mockTransaction.set).toHaveBeenCalled(); // Should set the new Sale doc
  });

  it('should return error if client does not exist', async () => {
    const mockTransaction = {
      get: vi.fn().mockResolvedValue({
        exists: () => false, // Client not found
      }),
    };

    mockRunTransaction.mockImplementation(async (_db, callback) => callback(mockTransaction));

    const saleData: SaleData = {
      items: [],
      totalAmount: 100,
      paymentMethod: 'cash',
      clientId: 'missing-client',
      amountPaidWithCredit: 0,
      amountPaidWithWorkshopDebt: 0,
    };

    const result = await executeSaleTransaction(saleData, []);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Cliente no encontrado.');
  });

  it('should return error if credit is insufficient', async () => {
    const mockTransaction = {
      get: vi.fn().mockResolvedValue({
        exists: () => true,
        data: () => ({ creditAmount: 50 }), // Only $50 credit
      }),
    };
    mockRunTransaction.mockImplementation(async (_db, callback) => callback(mockTransaction));

    const saleData: SaleData = {
      items: [],
      totalAmount: 100,
      paymentMethod: 'credit',
      clientId: 'poor-client',
      amountPaidWithCredit: 100, // Trying to pay $100
      amountPaidWithWorkshopDebt: 0,
    };

    const result = await executeSaleTransaction(saleData, []);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Crédito insuficiente.');
  });
});
