import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { type ReactNode, useContext } from 'react';
import { AuthContext, AuthProvider } from '../AuthContext';

vi.mock('../../lib/firebase', () => ({
  auth: {},
  db: {},
}));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_a: unknown, cb: (u: null) => void) => {
    cb(null);
    return () => {};
  },
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
}));

describe('AuthContext stability', () => {
  it('signIn and signOut are stable across renders', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result, rerender } = renderHook(() => useContext(AuthContext), { wrapper });
    const first = result.current;
    rerender();
    const second = result.current;
    expect(second?.signIn).toBe(first?.signIn);
    expect(second?.signOut).toBe(first?.signOut);
  });

  it('context value identity stable when user/role/loading unchanged', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result, rerender } = renderHook(() => useContext(AuthContext), { wrapper });
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
