import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../lib/firebase', () => ({ db: {}, auth: {}, storage: {}, messaging: null }));
vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({})) }));
vi.mock('firebase/storage', () => ({ getStorage: vi.fn(() => ({})) }));
vi.mock('firebase/functions', () => ({ getFunctions: vi.fn(() => ({})) }));
vi.mock('firebase/messaging', () => ({ getMessaging: vi.fn(() => ({})) }));
const mockGetDocs = vi.fn();
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  limit: vi.fn(),
  getFirestore: vi.fn(() => ({})),
}));
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ enabled }) => {
    if (enabled === false) return { data: null, isLoading: false };
    return { data: null, isLoading: true };
  }),
}));

import { buildPhoneQuery } from '../hooks/usePhoneByImei';

describe('usePhoneByImei', () => {
  beforeEach(() => vi.clearAllMocks());
  it('rejects empty input', () => {
    expect(buildPhoneQuery('')).toBeNull();
    expect(buildPhoneQuery('   ')).toBeNull();
  });
  it('accepts short IMEIs (partial digits entered by user)', () => {
    expect(buildPhoneQuery('1234')).toBe('1234');
    expect(buildPhoneQuery('5678')).toBe('5678');
  });
  it('strips non-digit characters from IMEI', () => {
    expect(buildPhoneQuery('356-371-101-234-567')).toBe('356371101234567');
  });
  it('normalizes GS1 16-digit barcode', () => {
    expect(buildPhoneQuery('1356371101234567')).toBe('356371101234567');
  });
  it('accepts valid 15-digit IMEI', () => {
    expect(buildPhoneQuery('356371101234567')).toBe('356371101234567');
  });
});
