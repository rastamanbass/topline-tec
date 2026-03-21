import { describe, it, expect, vi, beforeEach } from 'vitest';
import { lockPhonesForPOS, unlockPhonesFromPOS } from '../stockLock';

// ── Firebase Mocks (must be before imports resolve) ──────────────────────────

const mockRunTransaction = vi.fn();
const mockDoc = vi.fn((_db: unknown, _coll: string, id?: string) => ({
  id: id || 'auto-id',
  path: id ? `${_coll}/${id}` : _coll,
}));

vi.mock('../../../lib/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-user', email: 'test@topline.com' } },
}));

vi.mock('firebase/firestore', () => ({
  runTransaction: (db: unknown, callback: (t: unknown) => Promise<unknown>) =>
    mockRunTransaction(db, callback),
  doc: (...args: unknown[]) => mockDoc(...args),
  serverTimestamp: () => 'MOCK_TIMESTAMP',
  increment: (n: number) => ({ type: 'increment', value: n }),
  arrayUnion: (val: unknown) => ({ type: 'arrayUnion', value: val }),
  getFirestore: vi.fn(),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Creates a mock Firestore transaction that returns given phone data */
function makeMockTransaction(
  phoneDataByCall: Array<{ exists: boolean; data?: Record<string, unknown>; id?: string }>
) {
  let callCount = 0;
  const update = vi.fn();

  const get = vi.fn().mockImplementation(() => {
    const entry = phoneDataByCall[callCount++] ?? phoneDataByCall[phoneDataByCall.length - 1];
    const snap: Record<string, unknown> = {
      id: entry.id || 'phone-id',
      exists: () => entry.exists,
    };
    if (entry.exists && entry.data) {
      snap.data = () => entry.data;
    }
    return Promise.resolve(snap);
  });

  return { get, update, set: vi.fn() };
}

/** Wire mockRunTransaction to execute the callback synchronously */
function runTransactionInline(transaction: ReturnType<typeof makeMockTransaction>) {
  mockRunTransaction.mockImplementation(
    async (_db: unknown, callback: (...args: unknown[]) => unknown) => {
      return callback(transaction);
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────

describe('lockPhonesForPOS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a no-op when phoneIds is empty', async () => {
    await lockPhonesForPOS([]);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('calls runTransaction once for a list of phones', async () => {
    const transaction = makeMockTransaction([
      {
        exists: true,
        id: 'phone-1',
        data: {
          estado: 'En Stock (Disponible para Venta)',
          reservation: null,
          marca: 'Apple',
          modelo: 'iPhone 15',
        },
      },
      {
        exists: true,
        id: 'phone-2',
        data: {
          estado: 'En Stock (Disponible para Venta)',
          reservation: null,
          marca: 'Apple',
          modelo: 'iPhone 14',
        },
      },
    ]);
    runTransactionInline(transaction);

    await lockPhonesForPOS(['phone-1', 'phone-2']);

    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
  });

  it('writes a POS_SALE reservation on each phone', async () => {
    const transaction = makeMockTransaction([
      {
        exists: true,
        id: 'phone-abc',
        data: {
          estado: 'En Stock (Disponible para Venta)',
          reservation: null,
          marca: 'Apple',
          modelo: 'iPhone 16',
        },
      },
    ]);
    runTransactionInline(transaction);

    await lockPhonesForPOS(['phone-abc']);

    // transaction.update should have been called with POS_SALE reservation
    expect(transaction.update).toHaveBeenCalledTimes(1);
    const updateCall = transaction.update.mock.calls[0];
    const updatePayload = updateCall[1] as Record<string, unknown>;
    const reservation = updatePayload.reservation as Record<string, unknown>;
    expect(reservation.reservedBy).toBe('POS_SALE');
    expect(typeof reservation.reservedAt).toBe('number');
    expect(typeof reservation.expiresAt).toBe('number');
    expect((reservation.expiresAt as number) > Date.now()).toBe(true); // Expires in future
  });

  it('throws when a phone is not found', async () => {
    const transaction = makeMockTransaction([{ exists: false, id: 'ghost-phone' }]);
    runTransactionInline(transaction);

    await expect(lockPhonesForPOS(['ghost-phone'])).rejects.toThrow(
      'ghost-phone no encontrado en inventario'
    );
  });

  it('throws when a phone is already sold (not in available state)', async () => {
    const transaction = makeMockTransaction([
      {
        exists: true,
        id: 'sold-phone',
        data: {
          estado: 'Vendido',
          reservation: null,
          marca: 'Apple',
          modelo: 'iPhone 13',
        },
      },
    ]);
    runTransactionInline(transaction);

    await expect(lockPhonesForPOS(['sold-phone'])).rejects.toThrow(
      'ya está reservado o no disponible'
    );
  });

  it('throws when a phone has an active B2B reservation', async () => {
    const futureExpiry = Date.now() + 30 * 60 * 1000; // 30 min from now
    const transaction = makeMockTransaction([
      {
        exists: true,
        id: 'b2b-phone',
        data: {
          estado: 'En Stock (Disponible para Venta)',
          reservation: {
            reservedBy: 'session-buyer-xyz',
            reservedAt: Date.now() - 5000,
            expiresAt: futureExpiry,
          },
          marca: 'Apple',
          modelo: 'iPhone 15 Pro',
        },
      },
    ]);
    runTransactionInline(transaction);

    await expect(lockPhonesForPOS(['b2b-phone'])).rejects.toThrow(
      'reservado por un comprador online'
    );
  });

  it('allows locking a phone whose B2B reservation has expired', async () => {
    const expiredTimestamp = Date.now() - 1000; // 1 second ago
    const transaction = makeMockTransaction([
      {
        exists: true,
        id: 'expired-b2b-phone',
        data: {
          estado: 'En Stock (Disponible para Venta)',
          reservation: {
            reservedBy: 'old-session-buyer',
            reservedAt: expiredTimestamp - 900000,
            expiresAt: expiredTimestamp,
          },
          marca: 'Apple',
          modelo: 'iPhone 14',
        },
      },
    ]);
    runTransactionInline(transaction);

    await expect(lockPhonesForPOS(['expired-b2b-phone'])).resolves.toBeUndefined();
    expect(transaction.update).toHaveBeenCalledTimes(1);
  });

  it('allows locking a phone that already has a POS_SALE reservation (our own lock)', async () => {
    const transaction = makeMockTransaction([
      {
        exists: true,
        id: 'pos-locked-phone',
        data: {
          estado: 'Apartado',
          reservation: {
            reservedBy: 'POS_SALE',
            reservedAt: Date.now() - 60000,
            expiresAt: Date.now() + 600000,
          },
          marca: 'Apple',
          modelo: 'iPhone 15 Pro Max',
        },
      },
    ]);
    runTransactionInline(transaction);

    await expect(lockPhonesForPOS(['pos-locked-phone'])).resolves.toBeUndefined();
    expect(transaction.update).toHaveBeenCalledTimes(1);
  });

  it('locks multiple phones atomically in a single transaction', async () => {
    const transaction = makeMockTransaction([
      {
        exists: true,
        id: 'phone-1',
        data: {
          estado: 'En Stock (Disponible para Venta)',
          reservation: null,
          marca: 'Apple',
          modelo: 'iPhone 14',
        },
      },
      {
        exists: true,
        id: 'phone-2',
        data: {
          estado: 'En Stock (Disponible para Venta)',
          reservation: null,
          marca: 'Apple',
          modelo: 'iPhone 15',
        },
      },
      {
        exists: true,
        id: 'phone-3',
        data: {
          estado: 'En Stock (Disponible para Venta)',
          reservation: null,
          marca: 'Samsung',
          modelo: 'Galaxy S24',
        },
      },
    ]);
    runTransactionInline(transaction);

    await lockPhonesForPOS(['phone-1', 'phone-2', 'phone-3']);

    // All three phones should receive a reservation update
    expect(transaction.update).toHaveBeenCalledTimes(3);
    // Still one runTransaction call (atomic)
    expect(mockRunTransaction).toHaveBeenCalledTimes(1);
  });

  it('aborts the whole transaction if any phone has an active B2B reservation', async () => {
    const futureExpiry = Date.now() + 10 * 60 * 1000;
    // phone-1 OK, phone-2 has B2B reservation
    const transaction = makeMockTransaction([
      {
        exists: true,
        id: 'phone-ok',
        data: {
          estado: 'En Stock (Disponible para Venta)',
          reservation: null,
          marca: 'Apple',
          modelo: 'iPhone 14',
        },
      },
      {
        exists: true,
        id: 'phone-b2b',
        data: {
          estado: 'En Stock (Disponible para Venta)',
          reservation: {
            reservedBy: 'buyer-session-999',
            reservedAt: Date.now() - 5000,
            expiresAt: futureExpiry,
          },
          marca: 'Apple',
          modelo: 'iPhone 15',
        },
      },
    ]);
    runTransactionInline(transaction);

    await expect(lockPhonesForPOS(['phone-ok', 'phone-b2b'])).rejects.toThrow(
      'reservado por un comprador online'
    );

    // No updates should have been written (transaction aborted by throw)
    expect(transaction.update).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('unlockPhonesFromPOS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a no-op when phoneIds is empty', async () => {
    await unlockPhonesFromPOS([]);
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it('clears POS reservation and restores estado to En Stock', async () => {
    const transaction = makeMockTransaction([
      {
        exists: true,
        id: 'pos-phone',
        data: {
          estado: 'Apartado',
          reservation: {
            reservedBy: 'POS_SALE',
            reservedAt: Date.now() - 60000,
            expiresAt: Date.now() + 600000,
          },
        },
      },
    ]);
    runTransactionInline(transaction);

    await unlockPhonesFromPOS(['pos-phone']);

    expect(transaction.update).toHaveBeenCalledTimes(1);
    const updatePayload = transaction.update.mock.calls[0][1] as Record<string, unknown>;
    expect(updatePayload.reservation).toBeNull();
    expect(updatePayload.estado).toBe('En Stock (Disponible para Venta)');
  });

  it('does NOT clear a B2B reservation (only clears POS)', async () => {
    const futureExpiry = Date.now() + 20 * 60 * 1000;
    const transaction = makeMockTransaction([
      {
        exists: true,
        id: 'b2b-phone',
        data: {
          estado: 'Apartado',
          reservation: {
            reservedBy: 'buyer-session-abc',
            reservedAt: Date.now() - 5000,
            expiresAt: futureExpiry,
          },
        },
      },
    ]);
    runTransactionInline(transaction);

    await unlockPhonesFromPOS(['b2b-phone']);

    // Should NOT update — reservation is B2B, not POS_SALE
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it('does NOT update when there is no reservation at all', async () => {
    const transaction = makeMockTransaction([
      {
        exists: true,
        id: 'free-phone',
        data: {
          estado: 'En Stock (Disponible para Venta)',
          reservation: null,
        },
      },
    ]);
    runTransactionInline(transaction);

    await unlockPhonesFromPOS(['free-phone']);

    expect(transaction.update).not.toHaveBeenCalled();
  });

  it('is a no-op if the phone does not exist (already deleted)', async () => {
    const transaction = makeMockTransaction([{ exists: false, id: 'ghost-phone' }]);
    runTransactionInline(transaction);

    // Should NOT throw
    await expect(unlockPhonesFromPOS(['ghost-phone'])).resolves.toBeUndefined();
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it('unlocks each phone in a separate runTransaction call (per-phone safety)', async () => {
    // unlockPhonesFromPOS runs one transaction PER phone to prevent race conditions
    const transaction = makeMockTransaction([
      {
        exists: true,
        id: 'phone-x',
        data: {
          estado: 'Apartado',
          reservation: { reservedBy: 'POS_SALE', expiresAt: Date.now() + 600000 },
        },
      },
    ]);
    runTransactionInline(transaction);

    await unlockPhonesFromPOS(['phone-x', 'phone-y', 'phone-z']);

    // Each phone gets its own transaction
    expect(mockRunTransaction).toHaveBeenCalledTimes(3);
  });

  it('is idempotent — calling twice does not cause errors', async () => {
    const transaction = makeMockTransaction([
      {
        exists: true,
        id: 'pos-phone',
        data: {
          estado: 'En Stock (Disponible para Venta)',
          reservation: null, // Already unlocked
        },
      },
    ]);
    // Wire the same transaction for both calls
    mockRunTransaction.mockImplementation(
      async (_db: unknown, callback: (...args: unknown[]) => unknown) => {
        return callback(transaction);
      }
    );

    await unlockPhonesFromPOS(['pos-phone']);
    await unlockPhonesFromPOS(['pos-phone']);

    // No updates since reservation was already null both times
    expect(transaction.update).not.toHaveBeenCalled();
  });
});
