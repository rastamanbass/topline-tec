import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeSaleTransaction, type SaleData } from '../transactions';

// Mock Firebase
const mockRunTransaction = vi.fn();
const mockDoc = vi.fn((_db: unknown, _coll: string, id?: string) => ({
  id: id || 'auto-id',
  path: id ? `${_coll}/${id}` : _coll,
}));
const mockCollection = vi.fn((_db: unknown, ...segments: string[]) => ({
  path: segments.join('/'),
}));

vi.mock('../../../lib/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user', email: 'test@topline.com' } },
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
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should process a sale of 100 items successfully', async () => {
    // Setup Mocks
    const mockClient = { name: 'Test Client', creditAmount: 1000000 };
    const mockTransaction = {
      get: vi.fn().mockImplementation(() =>
        Promise.resolve({
          exists: () => true,
          data: () => ({
            ...mockClient,
            estado: 'En Stock (Disponible para Venta)',
            reservation: null,
          }),
        })
      ),
      update: vi.fn(),
      set: vi.fn(),
    };

    mockRunTransaction.mockImplementation(
      async (_db: unknown, callback: (...args: unknown[]) => unknown) => {
        return callback(mockTransaction);
      }
    );

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

    mockRunTransaction.mockImplementation(
      async (_db: unknown, callback: (...args: unknown[]) => unknown) => callback(mockTransaction)
    );

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
    mockRunTransaction.mockImplementation(
      async (_db: unknown, callback: (...args: unknown[]) => unknown) => callback(mockTransaction)
    );

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

  // ── NEW TESTS ─────────────────────────────────────────────────────────────

  describe('B2B reservation guard', () => {
    it('rejects sale when phone has an active B2B reservation', async () => {
      const futureTimestamp = Date.now() + 30 * 60 * 1000; // 30 min in future

      const mockTransaction = {
        get: vi
          .fn()
          .mockResolvedValueOnce({
            // Client doc
            exists: () => true,
            data: () => ({ name: 'Test Client', creditAmount: 1000 }),
          })
          .mockResolvedValueOnce({
            // Phone doc — has active B2B reservation
            exists: () => true,
            data: () => ({
              estado: 'En Stock (Disponible para Venta)',
              marca: 'Apple',
              modelo: 'iPhone 15 Pro',
              reservation: {
                reservedBy: 'session-buyer-123', // NOT 'POS_SALE'
                expiresAt: futureTimestamp,
                reservedAt: Date.now(),
              },
            }),
          }),
        update: vi.fn(),
        set: vi.fn(),
      };

      mockRunTransaction.mockImplementation(
        async (_db: unknown, callback: (...args: unknown[]) => unknown) => callback(mockTransaction)
      );

      const saleData: SaleData = {
        items: [
          {
            phoneId: 'reserved-phone',
            description: 'iPhone 15 Pro',
            price: 800,
            quantity: 1,
            type: 'phone',
          },
        ],
        totalAmount: 800,
        paymentMethod: 'cash',
        clientId: 'client-456',
        amountPaidWithCredit: 0,
        amountPaidWithWorkshopDebt: 0,
      };

      const result = await executeSaleTransaction(saleData, []);
      expect(result.success).toBe(false);
      expect(result.error).toContain('reservado por un comprador online');
    });

    it('allows sale when B2B reservation has expired', async () => {
      const expiredTimestamp = Date.now() - 1000; // 1 second ago

      const mockTransaction = {
        get: vi
          .fn()
          .mockResolvedValueOnce({
            exists: () => true,
            data: () => ({ name: 'Test Client', creditAmount: 1000 }),
          })
          .mockResolvedValueOnce({
            exists: () => true,
            data: () => ({
              estado: 'En Stock (Disponible para Venta)',
              marca: 'Apple',
              modelo: 'iPhone 14',
              reservation: {
                reservedBy: 'session-buyer-old',
                expiresAt: expiredTimestamp,
                reservedAt: expiredTimestamp - 1800000,
              },
            }),
          }),
        update: vi.fn(),
        set: vi.fn(),
      };

      mockRunTransaction.mockImplementation(
        async (_db: unknown, callback: (...args: unknown[]) => unknown) => callback(mockTransaction)
      );

      const saleData: SaleData = {
        items: [
          {
            phoneId: 'expired-reservation-phone',
            description: 'iPhone 14',
            price: 600,
            quantity: 1,
            type: 'phone',
          },
        ],
        totalAmount: 600,
        paymentMethod: 'cash',
        clientId: 'client-789',
        amountPaidWithCredit: 0,
        amountPaidWithWorkshopDebt: 0,
      };

      const result = await executeSaleTransaction(saleData, []);
      expect(result.success).toBe(true);
    });

    it('allows sale when reservation is POS_SALE (our own reservation)', async () => {
      const mockTransaction = {
        get: vi
          .fn()
          .mockResolvedValueOnce({
            exists: () => true,
            data: () => ({ name: 'Test Client', creditAmount: 1000 }),
          })
          .mockResolvedValueOnce({
            exists: () => true,
            data: () => ({
              estado: 'Apartado', // Reserved state
              marca: 'Apple',
              modelo: 'iPhone 16',
              reservation: {
                reservedBy: 'POS_SALE', // Our own reservation
                expiresAt: Date.now() + 60000,
                reservedAt: Date.now(),
              },
            }),
          }),
        update: vi.fn(),
        set: vi.fn(),
      };

      mockRunTransaction.mockImplementation(
        async (_db: unknown, callback: (...args: unknown[]) => unknown) => callback(mockTransaction)
      );

      const saleData: SaleData = {
        items: [
          {
            phoneId: 'pos-reserved-phone',
            description: 'iPhone 16',
            price: 900,
            quantity: 1,
            type: 'phone',
          },
        ],
        totalAmount: 900,
        paymentMethod: 'cash',
        clientId: 'client-pos',
        amountPaidWithCredit: 0,
        amountPaidWithWorkshopDebt: 0,
      };

      const result = await executeSaleTransaction(saleData, []);
      expect(result.success).toBe(true);
    });
  });

  describe('Workshop debt payment flow', () => {
    it('marks unpaid repairs as paid when paying workshop debt', async () => {
      const repairDate = new Date('2026-01-15');

      const phonesWithRepairs = [
        {
          id: 'repair-phone-1',
          imei: '123456789012345',
          marca: 'Apple',
          modelo: 'iPhone 14',
          lote: 'L1',
          costo: 400,
          precioVenta: 700,
          estado: 'En Stock (Disponible para Venta)' as const,
          fechaIngreso: new Date(),
          reparaciones: [
            { date: repairDate, note: 'Screen repair', cost: 50, paid: false, user: 'taller1' },
            { date: repairDate, note: 'Battery', cost: 30, paid: true, user: 'taller1' },
          ],
        },
      ];

      const mockTransaction = {
        get: vi
          .fn()
          .mockResolvedValueOnce({
            // Client
            exists: () => true,
            data: () => ({ name: 'Workshop Account', creditAmount: 0 }),
          })
          .mockResolvedValueOnce({
            // Phone with repairs (read inside transaction)
            exists: () => true,
            data: () => ({
              estado: 'En Stock (Disponible para Venta)',
              marca: 'Apple',
              modelo: 'iPhone 14',
              reparaciones: phonesWithRepairs[0].reparaciones,
            }),
          }),
        update: vi.fn(),
        set: vi.fn(),
      };

      mockRunTransaction.mockImplementation(
        async (_db: unknown, callback: (...args: unknown[]) => unknown) => callback(mockTransaction)
      );

      const saleData: SaleData = {
        items: [], // No phones being sold, just paying debt
        totalAmount: 50,
        paymentMethod: 'cash',
        clientId: 'workshop-client',
        amountPaidWithCredit: 0,
        amountPaidWithWorkshopDebt: 50,
      };

      const result = await executeSaleTransaction(saleData, phonesWithRepairs);
      expect(result.success).toBe(true);

      // Should have updated the phone's reparaciones with paid=true
      expect(mockTransaction.update).toHaveBeenCalled();
    });

    it('rejects sale of phone not in stock', async () => {
      const mockTransaction = {
        get: vi
          .fn()
          .mockResolvedValueOnce({
            exists: () => true,
            data: () => ({ name: 'Test Client', creditAmount: 0 }),
          })
          .mockResolvedValueOnce({
            exists: () => true,
            data: () => ({
              estado: 'Vendido', // Already sold
              marca: 'Apple',
              modelo: 'iPhone 13',
              reservation: null,
            }),
          }),
        update: vi.fn(),
        set: vi.fn(),
      };

      mockRunTransaction.mockImplementation(
        async (_db: unknown, callback: (...args: unknown[]) => unknown) => callback(mockTransaction)
      );

      const saleData: SaleData = {
        items: [
          {
            phoneId: 'already-sold-phone',
            description: 'iPhone 13',
            price: 500,
            quantity: 1,
            type: 'phone',
          },
        ],
        totalAmount: 500,
        paymentMethod: 'cash',
        clientId: 'client-x',
        amountPaidWithCredit: 0,
        amountPaidWithWorkshopDebt: 0,
      };

      const result = await executeSaleTransaction(saleData, []);
      expect(result.success).toBe(false);
      expect(result.error).toContain('ya no está disponible');
    });
  });

  describe('accessory sale', () => {
    it('decrements accessory quantity on sale', async () => {
      const mockTransaction = {
        get: vi
          .fn()
          .mockResolvedValueOnce({
            // Client
            exists: () => true,
            data: () => ({ name: 'Client', creditAmount: 0 }),
          })
          .mockResolvedValueOnce({
            // Accessory — sufficient stock
            exists: () => true,
            data: () => ({ cantidad: 10, nombre: 'iPhone 15 Case' }),
          }),
        update: vi.fn(),
        set: vi.fn(),
      };

      mockRunTransaction.mockImplementation(
        async (_db: unknown, callback: (...args: unknown[]) => unknown) => callback(mockTransaction)
      );

      const saleData: SaleData = {
        items: [
          {
            accessoryId: 'case-001',
            description: 'iPhone 15 Case',
            price: 15,
            quantity: 2,
            type: 'accessory',
          },
        ],
        totalAmount: 30,
        paymentMethod: 'cash',
        clientId: 'client-acc',
        amountPaidWithCredit: 0,
        amountPaidWithWorkshopDebt: 0,
      };

      const result = await executeSaleTransaction(saleData, []);
      expect(result.success).toBe(true);

      // Should decrement accessory quantity
      expect(mockTransaction.update).toHaveBeenCalled();
    });

    it('BUG: rejects sale when accessory stock insufficient (transaction.get + guard)', async () => {
      const mockTransaction = {
        get: vi
          .fn()
          .mockResolvedValueOnce({
            // Client
            exists: () => true,
            data: () => ({ name: 'Walk-in', creditAmount: 0 }),
          })
          .mockResolvedValueOnce({
            // Accessory — only 1 in stock but trying to sell 5
            exists: () => true,
            data: () => ({ cantidad: 1, nombre: 'Cargador' }),
          }),
        update: vi.fn(),
        set: vi.fn(),
      };

      mockRunTransaction.mockImplementation(
        async (_db: unknown, callback: (...args: unknown[]) => unknown) => callback(mockTransaction)
      );

      const saleData: SaleData = {
        items: [
          {
            accessoryId: 'a1',
            description: 'Cargador',
            price: 10,
            quantity: 5,
            type: 'accessory',
          },
        ],
        totalAmount: 50,
        paymentMethod: 'Efectivo',
        clientId: 'client-oversell',
        amountPaidWithCredit: 0,
        amountPaidWithWorkshopDebt: 0,
      };

      const result = await executeSaleTransaction(saleData, []);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/stock insuficiente|cantidad/i);
      expect(mockTransaction.update).not.toHaveBeenCalled();
    });
  });

  // ── BUG-1: empty clientId cash sale ────────────────────────────────────────
  // When clientId is '' (empty string), clientRef should be null.
  // The code must NOT try to create a client document reference and must NOT
  // crash when credit or debt are requested without a client.

  describe('BUG-1: cash sale with empty clientId', () => {
    it('succeeds without crashing — no client ref created when clientId is empty', async () => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({
            estado: 'En Stock (Disponible para Venta)',
            reservation: null,
            marca: 'Apple',
            modelo: 'iPhone 14',
          }),
        }),
        update: vi.fn(),
        set: vi.fn(),
      };

      mockRunTransaction.mockImplementation(
        async (_db: unknown, callback: (...args: unknown[]) => unknown) => callback(mockTransaction)
      );

      const saleData: SaleData = {
        items: [
          {
            phoneId: 'phone-cash-001',
            description: 'iPhone 14',
            price: 600,
            quantity: 1,
            type: 'phone',
          },
        ],
        totalAmount: 600,
        paymentMethod: 'Efectivo',
        clientId: '', // Empty — no client selected
        amountPaidWithCredit: 0,
        amountPaidWithWorkshopDebt: 0,
      };

      const result = await executeSaleTransaction(saleData, []);
      expect(result.success).toBe(true);

      // transaction.get should NOT have been called with a clients/ path
      // (no client lookup when clientId is empty)
      const getCalls = mockTransaction.get.mock.calls as unknown[][];
      const clientGetCalls = getCalls.filter((call) => {
        const ref = call[0] as { path?: string } | undefined;
        return ref?.path?.startsWith('clients/');
      });
      expect(clientGetCalls).toHaveLength(0);
    });

    it('rejects credit usage when clientId is empty', async () => {
      const mockTransaction = {
        get: vi.fn(),
        update: vi.fn(),
        set: vi.fn(),
      };

      mockRunTransaction.mockImplementation(
        async (_db: unknown, callback: (...args: unknown[]) => unknown) => callback(mockTransaction)
      );

      const saleData: SaleData = {
        items: [],
        totalAmount: 100,
        paymentMethod: 'Efectivo',
        clientId: '', // No client
        amountPaidWithCredit: 50, // Should be rejected
        amountPaidWithWorkshopDebt: 0,
      };

      const result = await executeSaleTransaction(saleData, []);
      expect(result.success).toBe(false);
      expect(result.error).toContain('crédito');
    });

    it('rejects debt generation when clientId is empty', async () => {
      const mockTransaction = {
        get: vi.fn(),
        update: vi.fn(),
        set: vi.fn(),
      };

      mockRunTransaction.mockImplementation(
        async (_db: unknown, callback: (...args: unknown[]) => unknown) => callback(mockTransaction)
      );

      const saleData: SaleData = {
        items: [],
        totalAmount: 200,
        paymentMethod: 'Efectivo',
        clientId: '', // No client
        amountPaidWithCredit: 0,
        amountPaidWithWorkshopDebt: 0,
        debtIncurred: 100, // Should be rejected
      };

      const result = await executeSaleTransaction(saleData, []);
      expect(result.success).toBe(false);
      expect(result.error).toContain('deuda');
    });

    it('does NOT create a purchase record when clientId is empty', async () => {
      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({
            estado: 'En Stock (Disponible para Venta)',
            reservation: null,
            marca: 'Apple',
            modelo: 'iPhone 13',
          }),
        }),
        update: vi.fn(),
        set: vi.fn(),
      };

      mockRunTransaction.mockImplementation(
        async (_db: unknown, callback: (...args: unknown[]) => unknown) => callback(mockTransaction)
      );

      const saleData: SaleData = {
        items: [
          {
            phoneId: 'phone-no-client',
            description: 'iPhone 13',
            price: 500,
            quantity: 1,
            type: 'phone',
          },
        ],
        totalAmount: 500,
        paymentMethod: 'Efectivo',
        clientId: '', // No client
        amountPaidWithCredit: 0,
        amountPaidWithWorkshopDebt: 0,
      };

      const result = await executeSaleTransaction(saleData, []);
      expect(result.success).toBe(true);

      // transaction.set should NOT be called (no purchase record without client)
      expect(mockTransaction.set).not.toHaveBeenCalled();
    });
  });

  // ── BUG-2: sold phone should have reservation: null ─────────────────────────
  // After a phone is sold, the reservation field must be explicitly set to null
  // so that it doesn't block future POS locks or B2B checks.

  describe('BUG-2: sold phone reservation cleared', () => {
    it('phone update includes reservation: null when phone is sold', async () => {
      const mockTransaction = {
        get: vi
          .fn()
          .mockResolvedValueOnce({
            // Client
            exists: () => true,
            data: () => ({ name: 'Test Client', creditAmount: 0 }),
          })
          .mockResolvedValueOnce({
            // Phone — had POS reservation
            exists: () => true,
            data: () => ({
              estado: 'Apartado',
              marca: 'Apple',
              modelo: 'iPhone 15',
              reservation: {
                reservedBy: 'POS_SALE',
                reservedAt: Date.now() - 60000,
                expiresAt: Date.now() + 600000,
              },
            }),
          }),
        update: vi.fn(),
        set: vi.fn(),
      };

      mockRunTransaction.mockImplementation(
        async (_db: unknown, callback: (...args: unknown[]) => unknown) => callback(mockTransaction)
      );

      const saleData: SaleData = {
        items: [
          {
            phoneId: 'pos-reserved-phone',
            description: 'iPhone 15',
            price: 800,
            quantity: 1,
            type: 'phone',
          },
        ],
        totalAmount: 800,
        paymentMethod: 'Efectivo',
        clientId: 'client-001',
        amountPaidWithCredit: 0,
        amountPaidWithWorkshopDebt: 0,
      };

      const result = await executeSaleTransaction(saleData, []);
      expect(result.success).toBe(true);

      // Find the phone update call
      const phoneCalls = mockTransaction.update.mock.calls as unknown[][];
      const phoneUpdateCall = phoneCalls.find((call) => {
        const ref = call[0] as { path?: string } | undefined;
        return ref?.path?.startsWith('phones/');
      });
      expect(phoneUpdateCall).toBeDefined();

      const payload = phoneUpdateCall![1] as Record<string, unknown>;
      expect(payload.reservation).toBeNull();
      expect(payload.estado).toBe('Vendido');
    });

    it('phone sold without a prior POS reservation also has reservation: null', async () => {
      const mockTransaction = {
        get: vi
          .fn()
          .mockResolvedValueOnce({
            exists: () => true,
            data: () => ({ name: 'Walk-in Customer', creditAmount: 500 }),
          })
          .mockResolvedValueOnce({
            exists: () => true,
            data: () => ({
              estado: 'En Stock (Disponible para Venta)',
              marca: 'Samsung',
              modelo: 'Galaxy S24',
              reservation: null,
            }),
          }),
        update: vi.fn(),
        set: vi.fn(),
      };

      mockRunTransaction.mockImplementation(
        async (_db: unknown, callback: (...args: unknown[]) => unknown) => callback(mockTransaction)
      );

      const saleData: SaleData = {
        items: [
          {
            phoneId: 'clean-stock-phone',
            description: 'Galaxy S24',
            price: 700,
            quantity: 1,
            type: 'phone',
          },
        ],
        totalAmount: 700,
        paymentMethod: 'Efectivo',
        clientId: 'client-002',
        amountPaidWithCredit: 0,
        amountPaidWithWorkshopDebt: 0,
      };

      const result = await executeSaleTransaction(saleData, []);
      expect(result.success).toBe(true);

      const phoneCalls = mockTransaction.update.mock.calls as unknown[][];
      const phoneUpdateCall = phoneCalls.find((call) => {
        const ref = call[0] as { path?: string } | undefined;
        return ref?.path?.startsWith('phones/');
      });

      const payload = phoneUpdateCall![1] as Record<string, unknown>;
      expect(payload.reservation).toBeNull();
    });
  });

  // ── Workshop debt: reads phone data inside transaction ──────────────────────
  // The workshop debt logic must use FRESH data from the Firestore transaction,
  // NOT stale data from the in-memory `allPhones` cache. This prevents marking
  // repairs as paid based on outdated cache.

  describe('Workshop debt: reads phone data inside transaction (not stale cache)', () => {
    it('uses transaction.get to read phone repairs — not allPhones cache directly', async () => {
      const repairDate = new Date('2026-02-10');

      // The STALE cache shows paid=false; the FRESH transaction data also shows paid=false
      // but the important thing is that transaction.get was called for the repair phone.
      const phonesWithRepairs = [
        {
          id: 'repair-phone-fresh',
          imei: '111222333444555',
          marca: 'Apple',
          modelo: 'iPhone 12',
          lote: 'L2',
          costo: 300,
          precioVenta: 550,
          estado: 'En Stock (Disponible para Venta)' as const,
          fechaIngreso: new Date(),
          reparaciones: [
            {
              date: repairDate,
              note: 'Battery replacement',
              cost: 40,
              paid: false,
              user: 'taller1',
            },
          ],
        },
      ];

      const mockTransaction = {
        get: vi
          .fn()
          .mockResolvedValueOnce({
            // Client
            exists: () => true,
            data: () => ({ name: 'Workshop Account', creditAmount: 0 }),
          })
          .mockResolvedValueOnce({
            // Phone read INSIDE transaction (fresh data)
            exists: () => true,
            data: () => ({
              estado: 'En Stock (Disponible para Venta)',
              marca: 'Apple',
              modelo: 'iPhone 12',
              reparaciones: [
                {
                  date: repairDate,
                  note: 'Battery replacement',
                  cost: 40,
                  paid: false,
                  user: 'taller1',
                },
              ],
            }),
          }),
        update: vi.fn(),
        set: vi.fn(),
      };

      mockRunTransaction.mockImplementation(
        async (_db: unknown, callback: (...args: unknown[]) => unknown) => callback(mockTransaction)
      );

      const saleData: SaleData = {
        items: [],
        totalAmount: 40,
        paymentMethod: 'Efectivo',
        clientId: 'workshop-client',
        amountPaidWithCredit: 0,
        amountPaidWithWorkshopDebt: 40, // Pay $40 workshop debt
      };

      const result = await executeSaleTransaction(saleData, phonesWithRepairs);
      expect(result.success).toBe(true);

      // transaction.get must have been called at least twice:
      // once for the client, once for the repair phone (inside transaction)
      expect(mockTransaction.get).toHaveBeenCalledTimes(2);

      // The phone update should mark the repair as paid
      expect(mockTransaction.update).toHaveBeenCalled();
      const updateCalls = mockTransaction.update.mock.calls as unknown[][];
      const repairUpdateCall = updateCalls.find((call) => {
        const ref = call[0] as { path?: string } | undefined;
        return ref?.path?.startsWith('phones/');
      });
      expect(repairUpdateCall).toBeDefined();

      const payload = repairUpdateCall![1] as { reparaciones?: Array<{ paid: boolean }> };
      expect(payload.reparaciones).toBeDefined();
      expect(payload.reparaciones![0].paid).toBe(true);
    });

    it('does not mark repairs as paid when workshop debt amount is 0', async () => {
      const phonesWithRepairs = [
        {
          id: 'repair-phone-no-pay',
          imei: '999888777666555',
          marca: 'Apple',
          modelo: 'iPhone 11',
          lote: 'L3',
          costo: 200,
          precioVenta: 400,
          estado: 'En Stock (Disponible para Venta)' as const,
          fechaIngreso: new Date(),
          reparaciones: [
            {
              date: new Date('2026-01-05'),
              note: 'Screen crack',
              cost: 60,
              paid: false,
              user: 'taller2',
            },
          ],
        },
      ];

      const mockTransaction = {
        get: vi.fn().mockResolvedValue({
          exists: () => true,
          data: () => ({ name: 'Test Client', creditAmount: 0 }),
        }),
        update: vi.fn(),
        set: vi.fn(),
      };

      mockRunTransaction.mockImplementation(
        async (_db: unknown, callback: (...args: unknown[]) => unknown) => callback(mockTransaction)
      );

      const saleData: SaleData = {
        items: [],
        totalAmount: 0,
        paymentMethod: 'Efectivo',
        clientId: 'client-no-debt-pay',
        amountPaidWithCredit: 0,
        amountPaidWithWorkshopDebt: 0, // NOT paying any workshop debt
      };

      const result = await executeSaleTransaction(saleData, phonesWithRepairs);
      expect(result.success).toBe(true);

      // transaction.get should only have been called for the client (no repair phone reads)
      // because debtToPay === 0, the loop scanning for repairs never runs
      expect(mockTransaction.get).toHaveBeenCalledTimes(1);
    });
  });
});
