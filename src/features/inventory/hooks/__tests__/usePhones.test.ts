import { describe, it, expect, vi } from 'vitest';

// Isolate the doc-ID logic: verify the new code path uses the IMEI as the doc id
// and fails when the doc already exists.
vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual<typeof import('firebase/firestore')>('firebase/firestore');
  return {
    ...actual,
    doc: vi.fn((_db, path, id) => ({ path, id, _mock: 'docRef' })),
    getDoc: vi.fn(),
    setDoc: vi.fn(),
    collection: vi.fn(),
    addDoc: vi.fn(),
    serverTimestamp: () => 'SERVER_TS',
  };
});

vi.mock('../../../../lib/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'u1', email: 'test@tl.com' } },
}));

vi.mock('../../services/deviceService', () => ({
  saveDeviceDefinition: vi.fn(),
}));

describe('useCreatePhone — IMEI uniqueness', () => {
  it('writes using imei as doc id and fails when doc already exists', async () => {
    const { doc, getDoc, setDoc } = await import('firebase/firestore');
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => true } as never);

    const { createPhoneOrFail } = await import('../usePhones');
    await expect(
      createPhoneOrFail({
        imei: '356371101234567',
        marca: 'Apple',
        modelo: 'iPhone 14',
        storage: '128',
        lote: 'LOTE-1',
        costo: 500,
        precioVenta: 800,
        estado: 'En Stock (Disponible para Venta)',
      } as never)
    ).rejects.toThrow(/ya existe|duplicate/i);

    expect(doc).toHaveBeenCalledWith({}, 'phones', '356371101234567');
    // setDoc may be called for price_catalog (fire-and-forget) but NOT for phones
    const phoneSetDocCall = vi.mocked(setDoc).mock.calls.find((call) => {
      const ref = call[0] as { path?: string };
      return ref?.path === 'phones';
    });
    expect(phoneSetDocCall).toBeUndefined();
  });

  it('writes using imei as doc id when no existing doc', async () => {
    const { doc, getDoc, setDoc } = await import('firebase/firestore');
    vi.mocked(getDoc).mockReset();
    vi.mocked(setDoc).mockReset();
    vi.mocked(doc).mockClear();
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as never);
    vi.mocked(setDoc).mockResolvedValue(undefined as never);

    const { createPhoneOrFail } = await import('../usePhones');
    const id = await createPhoneOrFail({
      imei: '356371101234567',
      marca: 'Apple',
      modelo: 'iPhone 14',
      storage: '128',
      lote: 'LOTE-1',
      costo: 500,
      precioVenta: 800,
      estado: 'En Stock (Disponible para Venta)',
    } as never);

    expect(id).toBe('356371101234567');
    expect(doc).toHaveBeenCalledWith({}, 'phones', '356371101234567');
    // setDoc called at least once for the phone; may also be called for price_catalog
    const phoneSetDocCall = vi.mocked(setDoc).mock.calls.find((call) => {
      const ref = call[0] as { path?: string };
      return ref?.path === 'phones';
    });
    expect(phoneSetDocCall).toBeDefined();
  });
});
