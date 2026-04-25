# Week 1 Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate 8 HIGH/CRITICAL bugs surfaced by the 2026-04-19 parallel audit (security, race conditions, business logic, performance) with failing tests first, minimal fixes, and zero regressions to the 222-test baseline.

**Architecture:** Each task is a vertical slice (test → fix → verify → commit). Tasks 1, 2, 5 are independent frontend-only fixes that can run in parallel. Tasks 3, 4 touch Firestore writes and share helpers but have no file overlap. Tasks 6–8 all edit `firestore.rules` and MUST run sequentially in task order.

**Tech Stack:** React 19 + TypeScript 5 + Vite 7 + Firebase 12 (Firestore + Auth + Storage + Rules) + Zustand 5 + vitest 4 + @testing-library/react 16 + @firebase/rules-unit-testing.

**Working directory:** This plan was authored inside the worktree `/Users/danielabrego/Projects/topline-tec-week1-fixes` on branch `fix/week1-audit-remediation`. All work happens here; `main` is untouched until PR merge.

**Baseline before work:** `npx vitest run` → 222 passed / 13 files / ~2.8s. Re-run before starting Task 1 to confirm.

---

## File Structure

Files created or modified, by task:

| Task | File | Responsibility |
|------|------|----------------|
| 1 | `src/features/sales/stores/salesStore.ts` | `addToCart` / `addBulkToCart` dedupe by `phoneId` |
| 1 | `src/features/sales/stores/__tests__/salesStore.test.ts` | Regression test for dedupe |
| 2 | `src/services/firebase/transactions.ts` | `executeSaleTransaction` reads accessory before decrement |
| 2 | `src/services/firebase/__tests__/transactions.test.ts` | Regression test for oversell |
| 3 | `src/features/inventory/hooks/usePhones.ts` | `useCreatePhone` uses `setDoc(doc('phones', imei))` not `addDoc` |
| 3 | `src/features/inventory/hooks/__tests__/usePhones.test.ts` (new) | Collision test |
| 4 | `src/features/receiving/hooks/useReceivingSession.ts` | `closeReceiving` uses `runTransaction` + `arrayUnion` |
| 4 | `src/features/receiving/hooks/__tests__/useReceivingSession.test.ts` | Concurrent statusHistory regression |
| 5 | `src/context/AuthContext.tsx` | `useMemo`/`useCallback` for `value`, `signIn`, `signOut` |
| 5 | `src/context/__tests__/AuthContext.test.tsx` (new) | Identity stability test |
| 6 | `firestore.rules` + `firestore.indexes.json` | `/publicCatalog` collection + rule; remove `costo`/`supplierCode` exposure |
| 6 | `src/features/public/hooks/usePublicPhones.ts` | Read from `publicCatalog` instead of `phones` |
| 6 | `scripts/sync-public-catalog.mjs` (new) | One-shot migration to seed `publicCatalog` |
| 7 | `firestore.rules` | `pendingOrders create` ownership + status guard |
| 8 | `firestore.rules` | `users` read restricted to own doc or admin/gerente |
| 6–8 | `src/test/rules/*.test.ts` (new) | `@firebase/rules-unit-testing` suite |

---

## Pre-flight

- [ ] **Step 0.1: Verify baseline**

Run: `cd /Users/danielabrego/Projects/topline-tec-week1-fixes && npx vitest run`
Expected: `Tests 222 passed (222)`. If not, stop and reconcile.

- [ ] **Step 0.2: Install rules-testing dep (needed for Tasks 6–8)**

Run: `npm install --save-dev @firebase/rules-unit-testing`
Expected: new entry in `package.json` devDependencies, no vulnerabilities that block install.

- [ ] **Step 0.3: Commit baseline dep**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add @firebase/rules-unit-testing for rules tests"
```

---

## Task 1: Cart dedupe by phoneId

**Files:**
- Modify: `src/features/sales/stores/salesStore.ts:42-43`
- Test: `src/features/sales/stores/__tests__/salesStore.test.ts`

**Background:** `addToCart` appends unconditionally; two fast clicks (or scanner echo) put the same `phoneId` twice, inflating `totalAmount` in `executeSaleTransaction` (`transactions.ts:30-297`). The cotizador already dedupes (`useCotizador.ts:29-32`) — mirror that.

- [ ] **Step 1.1: Write failing test**

Append to `src/features/sales/stores/__tests__/salesStore.test.ts` (inside the existing `describe`):

```typescript
it('BUG: addToCart rejects duplicate phoneId (cart-only phones, accessories allowed to stack)', () => {
  const store = useSalesStore.getState();
  store.clearCart();
  const phoneItem = { phoneId: 'p1', name: 'iPhone 14', price: 800, quantity: 1 };
  store.addToCart(phoneItem);
  store.addToCart(phoneItem);
  expect(useSalesStore.getState().cartItems).toHaveLength(1);
});

it('BUG: addBulkToCart dedupes phoneIds already in cart', () => {
  const store = useSalesStore.getState();
  store.clearCart();
  store.addToCart({ phoneId: 'p1', name: 'iPhone 14', price: 800, quantity: 1 });
  store.addBulkToCart([
    { phoneId: 'p1', name: 'iPhone 14', price: 800, quantity: 1 },
    { phoneId: 'p2', name: 'Galaxy S24', price: 900, quantity: 1 },
  ]);
  const items = useSalesStore.getState().cartItems;
  expect(items).toHaveLength(2);
  expect(items.map((i) => i.phoneId)).toEqual(['p1', 'p2']);
});

it('addToCart with accessoryId allows stacking (qty editable downstream)', () => {
  const store = useSalesStore.getState();
  store.clearCart();
  const acc = { accessoryId: 'a1', name: 'Cargador', price: 10, quantity: 1 };
  store.addToCart(acc);
  store.addToCart(acc);
  expect(useSalesStore.getState().cartItems).toHaveLength(2);
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

Run: `npx vitest run src/features/sales/stores/__tests__/salesStore.test.ts`
Expected: the two `BUG:` tests FAIL (`Expected length: 1 / 2, Received: 2 / 3`). The accessory test passes.

- [ ] **Step 1.3: Implement fix**

Replace lines 42-43 in `src/features/sales/stores/salesStore.ts`:

```typescript
  addToCart: (item) =>
    set((state) => {
      if (item.phoneId && state.cartItems.some((i) => i.phoneId === item.phoneId)) {
        return state;
      }
      return { cartItems: [...state.cartItems, item] };
    }),
  addBulkToCart: (items) =>
    set((state) => {
      const existingPhoneIds = new Set(
        state.cartItems.map((i) => i.phoneId).filter(Boolean) as string[]
      );
      const deduped = items.filter((i) => !i.phoneId || !existingPhoneIds.has(i.phoneId));
      return { cartItems: [...state.cartItems, ...deduped] };
    }),
```

- [ ] **Step 1.4: Run tests to verify pass**

Run: `npx vitest run src/features/sales/stores/__tests__/salesStore.test.ts`
Expected: all tests pass (including the 3 new ones).

- [ ] **Step 1.5: Run full suite — no regressions**

Run: `npx vitest run`
Expected: `Tests 225 passed` (222 + 3 new).

- [ ] **Step 1.6: Commit**

```bash
git add src/features/sales/stores/salesStore.ts src/features/sales/stores/__tests__/salesStore.test.ts
git commit -m "fix(sales): dedupe phoneId in addToCart/addBulkToCart (prevents double-charge)"
```

---

## Task 2: Accessory oversell guard in sale transaction

**Files:**
- Modify: `src/services/firebase/transactions.ts:292-295`
- Test: `src/services/firebase/__tests__/transactions.test.ts`

**Background:** Line 294 does `transaction.update(accRef, { cantidad: increment(-item.quantity) })` without reading. Two concurrent sales of the last unit → `cantidad === -1`. Must `transaction.get(accRef)` first, validate `cantidad >= item.quantity`, throw if not.

- [ ] **Step 2.1: Write failing test**

Append to `src/services/firebase/__tests__/transactions.test.ts` (inside its `describe`):

```typescript
it('BUG: rejects sale when accessory stock insufficient (transaction.get + guard)', async () => {
  const mockGet = vi.fn().mockResolvedValue({
    exists: () => true,
    data: () => ({ cantidad: 1, nombre: 'Cargador' }),
  });
  const mockUpdate = vi.fn();
  const runTransactionMock = vi.mocked(runTransaction);
  runTransactionMock.mockImplementationOnce(async (_db, fn) =>
    fn({ get: mockGet, update: mockUpdate, set: vi.fn() } as any)
  );

  const result = await executeSaleTransaction({
    items: [{ accessoryId: 'a1', name: 'Cargador', price: 10, quantity: 5 }],
    totalAmount: 50,
    paymentMethod: 'Efectivo',
    clientId: null,
    clientName: 'Anónimo',
    notes: '',
  } as any);

  expect(result.success).toBe(false);
  expect(result.error).toMatch(/stock insuficiente|cantidad/i);
  expect(mockUpdate).not.toHaveBeenCalled();
});
```

- [ ] **Step 2.2: Run to verify fail**

Run: `npx vitest run src/services/firebase/__tests__/transactions.test.ts`
Expected: new test FAILS (current code does not read accessory; update proceeds).

- [ ] **Step 2.3: Implement fix**

Locate the block at lines 292–295 in `src/services/firebase/transactions.ts` and replace:

```typescript
        } else if (item.accessoryId) {
          const accRef = doc(db, 'accessories', item.accessoryId);
          const accSnap = await transaction.get(accRef);
          if (!accSnap.exists()) {
            throw new Error(`Accesorio ${item.name} no existe`);
          }
          const currentQty = Number(accSnap.data()?.cantidad ?? 0);
          if (currentQty < item.quantity) {
            throw new Error(
              `Stock insuficiente para ${item.name}: hay ${currentQty}, se requieren ${item.quantity}`
            );
          }
          transaction.update(accRef, { cantidad: increment(-item.quantity) });
        }
```

**Note:** Firestore requires all reads before writes inside a transaction. If other writes already happened in the same transaction before this branch, Firestore throws. Audit the existing transaction body: all phone reads already happen at the top (`transaction.get(phoneRef)` calls before the phone-update branch). Accessories had no read. Adding `transaction.get(accRef)` inside the second loop is legal ONLY if no write happened earlier in the same iteration. Verify by reading lines 150-295 of `transactions.ts` and moving the `transaction.get(accRef)` calls into the initial read phase if the linter/runtime complains.

- [ ] **Step 2.4: Run test to verify pass**

Run: `npx vitest run src/services/firebase/__tests__/transactions.test.ts`
Expected: pass.

- [ ] **Step 2.5: Full suite**

Run: `npx vitest run`
Expected: 226 passed.

- [ ] **Step 2.6: Commit**

```bash
git add src/services/firebase/transactions.ts src/services/firebase/__tests__/transactions.test.ts
git commit -m "fix(sales): prevent accessory oversell by reading stock in sale transaction"
```

---

## Task 3: IMEI uniqueness via deterministic doc ID

**Files:**
- Modify: `src/features/inventory/hooks/usePhones.ts:164-178` (replace `addDoc` with `setDoc` using IMEI as ID)
- Create: `src/features/inventory/hooks/__tests__/usePhones.test.ts`

**Background:** `addDoc(collection(db, 'phones'), ...)` generates auto-ID → two users creating the same IMEI produce two docs. Using the IMEI itself as the document ID (`doc(db, 'phones', imei)`) makes Firestore enforce uniqueness: a second `setDoc` with the same ID overwrites (unsafe) or — with our guard — throws.

**Migration risk:** Existing phone docs use auto-IDs. This task changes NEW creates only. All existing docs stay on their auto-IDs and continue to work (queries use `where('imei', '==', ...)`, not `doc.id`). The `id` field on the Phone type is still derived from `docRef.id`.

**Caveat:** The same IMEI could exist in two states (e.g., one "Vendido", one "En Stock" — representing a resale). If this is a valid business case, the fix below breaks it. Per CLAUDE.md and 222 current tests there is no evidence of this pattern. If the fix regresses a real flow, we roll back and switch to a transaction-based pre-check.

- [ ] **Step 3.1: Write failing test**

Create `src/features/inventory/hooks/__tests__/usePhones.test.ts`:

```typescript
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
        costo: 500,
        precioVenta: 800,
        estado: 'En Stock (Disponible para Venta)',
      } as never)
    ).rejects.toThrow(/ya existe|duplicate/i);

    expect(doc).toHaveBeenCalledWith({}, 'phones', '356371101234567');
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('writes using imei as doc id when no existing doc', async () => {
    const { doc, getDoc, setDoc } = await import('firebase/firestore');
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as never);
    vi.mocked(setDoc).mockResolvedValueOnce(undefined as never);

    const { createPhoneOrFail } = await import('../usePhones');
    const id = await createPhoneOrFail({
      imei: '356371101234567',
      marca: 'Apple',
      modelo: 'iPhone 14',
      storage: '128',
      costo: 500,
      precioVenta: 800,
      estado: 'En Stock (Disponible para Venta)',
    } as never);

    expect(id).toBe('356371101234567');
    expect(doc).toHaveBeenCalledWith({}, 'phones', '356371101234567');
    expect(setDoc).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3.2: Run to verify fail**

Run: `npx vitest run src/features/inventory/hooks/__tests__/usePhones.test.ts`
Expected: import of `createPhoneOrFail` fails (not exported yet).

- [ ] **Step 3.3: Implement fix — extract `createPhoneOrFail` then use it inside the mutation**

Replace the `mutationFn` body in `useCreatePhone` (lines 131-179 of `src/features/inventory/hooks/usePhones.ts`) with:

```typescript
export async function createPhoneOrFail(
  phone: Omit<Phone, 'id' | 'fechaIngreso' | 'statusHistory'>
): Promise<string> {
  if (!phone.imei || phone.imei.length < 8) {
    throw new Error('IMEI inválido (mínimo 8 dígitos)');
  }

  // Deterministic doc ID enforces uniqueness via Firestore
  const phoneRef = doc(db, 'phones', phone.imei);
  const existing = await getDoc(phoneRef);
  if (existing.exists()) {
    throw new Error(`IMEI ${phone.imei} ya existe (duplicate)`);
  }

  // Fire-and-forget TAC + price catalog learning (unchanged)
  if (phone.imei.length >= 8) {
    const tac = phone.imei.substring(0, 8);
    saveDeviceDefinition(tac, phone.marca, phone.modelo);
  }
  if (phone.precioVenta > 0 && phone.modelo) {
    const displayBrand = normalizeDisplayBrand(phone.marca);
    const storageVal = normalizeStorage(phone.storage);
    const normalizedModel =
      displayBrand === 'Apple'
        ? normalizeIPhoneModel(phone.modelo || '')
        : phone.modelo || 'Unknown';
    const safeId = `${displayBrand}-${normalizedModel}-${storageVal}`
      .replace(/\//g, '-')
      .replace(/\s+/g, '-')
      .toLowerCase();
    setDoc(
      doc(db, 'price_catalog', safeId),
      {
        brand: displayBrand,
        model: phone.modelo,
        storage: storageVal,
        averagePrice: phone.precioVenta,
        lastUpdated: new Date(),
        source: 'auto',
      },
      { merge: true }
    ).catch((err) => console.error('Failed to learn price', err));
  }

  await setDoc(phoneRef, {
    ...phone,
    fechaIngreso: serverTimestamp(),
    createdBy: auth.currentUser?.uid,
    updatedAt: serverTimestamp(),
    statusHistory: [
      {
        newStatus: phone.estado,
        date: new Date().toISOString(),
        user: auth.currentUser?.email || 'unknown',
        details: 'Teléfono creado',
      },
    ],
  });

  return phone.imei;
}

export function useCreatePhone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPhoneOrFail,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phones'] });
      queryClient.invalidateQueries({ queryKey: ['phones-paginated'] });
      toast.success('Teléfono creado exitosamente');
    },
    onError: (error: Error) => {
      console.error('Create phone error:', error);
      toast.error(`Error al crear teléfono: ${error.message}`);
    },
  });
}
```

Also ensure `getDoc` is added to the `firebase/firestore` import block at the top of `usePhones.ts`.

**Callers to verify:** grep for `useCreatePhone` — if any caller relied on the returned `docRef.id` being an auto-ID (not the IMEI), adjust. The `Phone.id` field in Firestore-reads is still `snapshot.id` so downstream code is unaffected.

- [ ] **Step 3.4: Run tests**

Run: `npx vitest run src/features/inventory/hooks/__tests__/usePhones.test.ts`
Expected: both tests pass.

- [ ] **Step 3.5: Regression sweep**

Run: `npx vitest run` and `npm run build`
Expected: all tests pass, no TypeScript errors.

- [ ] **Step 3.6: Commit**

```bash
git add src/features/inventory/hooks/usePhones.ts src/features/inventory/hooks/__tests__/usePhones.test.ts
git commit -m "fix(inventory): enforce IMEI uniqueness via deterministic doc id"
```

---

## Task 4: closeReceiving → runTransaction + arrayUnion

**Files:**
- Modify: `src/features/receiving/hooks/useReceivingSession.ts:210-287`
- Test: `src/features/receiving/hooks/__tests__/useReceivingSession.test.ts`

**Background:** `writeBatch` in `closeReceiving` reads `statusHistory` from stale react-query cache and writes it back as an array literal. If another admin added a history entry in parallel (e.g., marked phone as "De Baja"), their entry is silently lost. `runTransaction` rereads the doc server-side; `arrayUnion` appends without clobbering.

- [ ] **Step 4.1: Write failing test**

Append to `src/features/receiving/hooks/__tests__/useReceivingSession.test.ts`:

```typescript
describe('closeReceiving — concurrent statusHistory preservation', () => {
  it('BUG: must use runTransaction and arrayUnion, not writeBatch with literal array', () => {
    const source = readFileSync(
      resolve(__dirname, '../useReceivingSession.ts'),
      'utf8'
    );
    const closeBody = source.slice(
      source.indexOf('const closeReceiving'),
      source.indexOf('const reset')
    );
    expect(closeBody).toContain('runTransaction');
    expect(closeBody).toContain('arrayUnion');
    expect(closeBody).not.toMatch(/writeBatch\s*\(/);
    expect(closeBody).not.toMatch(/statusHistory:\s*\[\s*\.\.\.history/);
  });
});
```

Add imports at the top of the test file if not present:
```typescript
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
```

**Note on test style:** This is a structural/contract test (simpler than setting up transaction mocks). A deeper behavioral test requires the firestore emulator, which is out of scope for Week 1. When the emulator suite lands, replace this with a real concurrency test.

- [ ] **Step 4.2: Run to verify fail**

Run: `npx vitest run src/features/receiving/hooks/__tests__/useReceivingSession.test.ts`
Expected: new test FAILS (current code uses `writeBatch` + literal `[...history, ...]`).

- [ ] **Step 4.3: Implement fix**

Replace lines 220-250 (the `try { const batch = ... ; await batch.commit(); ... }` portion up to and including `await batch.commit()`) in `useReceivingSession.ts` with:

```typescript
    try {
      const userEmail = auth.currentUser?.email || 'unknown';
      const now = new Date();

      await runTransaction(db, async (txn) => {
        // Phase 1: read all phone docs fresh (transactions require reads-first)
        const reads = await Promise.all(
          okResults
            .filter((r) => r.phoneId)
            .map(async (r) => {
              const ref = doc(db, 'phones', r.phoneId!);
              const snap = await txn.get(ref);
              return { r, ref, snap };
            })
        );

        // Phase 2: write each with arrayUnion on statusHistory
        for (const { r, ref, snap } of reads) {
          if (!snap.exists()) continue; // skip: phone deleted mid-session
          const historyEntry = {
            newStatus: 'En Stock (Disponible para Venta)',
            date: now,
            user: userEmail,
            details: `Recibido – lote ${selectedLote}`,
          };
          const updateData: Record<string, unknown> = {
            estado: 'En Stock (Disponible para Venta)',
            updatedAt: serverTimestamp(),
            statusHistory: arrayUnion(historyEntry),
          };
          if (r.fullScannedImei && r.fullScannedImei !== r.imei) {
            updateData.imei = r.fullScannedImei;
          }
          txn.update(ref, updateData);
        }
      });
```

Add `runTransaction` and `arrayUnion` to the `firebase/firestore` import block at the top of the file. Remove `writeBatch` if no longer used.

- [ ] **Step 4.4: Run tests**

Run: `npx vitest run src/features/receiving/hooks/__tests__/useReceivingSession.test.ts`
Expected: new + all 22 existing receiving tests pass.

- [ ] **Step 4.5: Full suite**

Run: `npx vitest run`
Expected: 228 passed.

- [ ] **Step 4.6: Commit**

```bash
git add src/features/receiving/hooks/useReceivingSession.ts src/features/receiving/hooks/__tests__/useReceivingSession.test.ts
git commit -m "fix(receiving): closeReceiving uses runTransaction + arrayUnion to preserve concurrent statusHistory"
```

---

## Task 5: AuthContext value memoization

**Files:**
- Modify: `src/context/AuthContext.tsx:90-119`
- Create: `src/context/__tests__/AuthContext.test.tsx`

**Background:** `value = { user, userRole, loading, signIn, signOut }` creates new object + new closures every render. Every consumer of `useAuth()` re-renders on every Provider render.

- [ ] **Step 5.1: Write failing test**

Create `src/context/__tests__/AuthContext.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { ReactNode, useContext } from 'react';
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
```

- [ ] **Step 5.2: Run to verify fail**

Run: `npx vitest run src/context/__tests__/AuthContext.test.tsx`
Expected: both tests FAIL — `signIn` / value identity differs each render.

- [ ] **Step 5.3: Implement fix**

Replace lines 90-119 of `src/context/AuthContext.tsx`:

```typescript
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }, []);

  const value: AuthContextType = useMemo(
    () => ({ user, userRole, loading, signIn, signOut }),
    [user, userRole, loading, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
```

Add `useCallback` and `useMemo` to the `react` import at the top (alongside existing `useState`, `useEffect`, etc.).

- [ ] **Step 5.4: Tests**

Run: `npx vitest run src/context/__tests__/AuthContext.test.tsx`
Expected: both pass.

- [ ] **Step 5.5: Full suite**

Run: `npx vitest run`
Expected: 230 passed.

- [ ] **Step 5.6: Commit**

```bash
git add src/context/AuthContext.tsx src/context/__tests__/AuthContext.test.tsx
git commit -m "perf(auth): memoize AuthContext value and callbacks to stop cascade re-renders"
```

---

## Rules Test Harness Setup (prerequisite for Tasks 6–8)

**Files:**
- Create: `src/test/rules/setup.ts`
- Create: `firebase.json` entry for emulator (if not present — check first)
- Modify: `package.json` scripts

- [ ] **Step R.1: Verify emulator config**

Run: `cat firebase.json 2>/dev/null | head -40`
If `emulators.firestore` is already configured, skip to R.3. Otherwise proceed.

- [ ] **Step R.2: Add emulator config (if missing)**

Append (or merge) into `firebase.json`:

```json
{
  "emulators": {
    "firestore": { "port": 8080 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
}
```

- [ ] **Step R.3: Create rules test helper**

Create `src/test/rules/setup.ts`:

```typescript
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let env: RulesTestEnvironment | undefined;

export async function getEnv(): Promise<RulesTestEnvironment> {
  if (env) return env;
  env = await initializeTestEnvironment({
    projectId: 'topline-rules-test',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
    },
  });
  return env;
}

export async function cleanupEnv(): Promise<void> {
  if (env) {
    await env.cleanup();
    env = undefined;
  }
}
```

- [ ] **Step R.4: Add npm script**

Modify `package.json` `scripts`:

```json
"test:rules": "firebase emulators:exec --only firestore 'vitest run src/test/rules'"
```

- [ ] **Step R.5: Commit harness**

```bash
git add src/test/rules/setup.ts firebase.json package.json
git commit -m "test(rules): add @firebase/rules-unit-testing harness for firestore rules"
```

---

## Task 6: Firestore rules — public catalog projection (hide costo/supplierCode)

**Files:**
- Modify: `firestore.rules:46-61` (restrict `phones` read)
- Create: `firestore.rules` new `publicCatalog` match block
- Create: `scripts/sync-public-catalog.mjs` (one-time migration)
- Create: `functions/index.js` (onWrite trigger to mirror) — **IF** project already has Cloud Functions; otherwise document migration as manual and add to a follow-up task
- Modify: `src/features/public/hooks/usePublicPhones.ts` (if exists) to read from `publicCatalog`
- Test: `src/test/rules/phones.test.ts`

**Background:** The public `/catalogo` page reads `phones` directly with fields `costo` and `supplierCode` exposed. Move public fields (`marca`, `modelo`, `storage`, `precioVenta`, `condition`, `imageUrl`, `phoneId`) into a denormalized `publicCatalog/{phoneId}` collection; restrict `phones` reads to authenticated users.

- [ ] **Step 6.1: Write failing rules test**

Create `src/test/rules/phones.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getEnv, cleanupEnv } from './setup';

beforeAll(async () => { await getEnv(); });
afterAll(async () => { await cleanupEnv(); });

describe('Firestore rules — phones collection public read blocked', () => {
  beforeEach(async () => {
    const env = await getEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'phones', 'imei-in-stock'), {
        estado: 'En Stock (Disponible para Venta)',
        marca: 'Apple',
        modelo: 'iPhone 14',
        costo: 500,
        supplierCode: 'SUP-1',
        precioVenta: 800,
      });
    });
  });

  it('unauthenticated user CANNOT read phones (even En Stock)', async () => {
    const env = await getEnv();
    const ctx = env.unauthenticatedContext();
    await assertFails(getDoc(doc(ctx.firestore(), 'phones', 'imei-in-stock')));
  });

  it('unauthenticated user CAN read publicCatalog entries', async () => {
    const env = await getEnv();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'publicCatalog', 'imei-in-stock'), {
        marca: 'Apple',
        modelo: 'iPhone 14',
        precioVenta: 800,
      });
    });
    const ctx = env.unauthenticatedContext();
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'publicCatalog', 'imei-in-stock')));
  });
});
```

- [ ] **Step 6.2: Run — verify fail**

Run: `npm run test:rules -- src/test/rules/phones.test.ts`
Expected: both tests FAIL (current rules allow unauth read of Stock phones; `publicCatalog` doesn't exist).

- [ ] **Step 6.3: Amend firestore.rules**

In `firestore.rules`, replace lines 46-61 with:

```
    match /phones/{phoneId} {
      allow read: if isSignedIn();

      allow update: if (isAdmin() || isGerente()) ||
                    (isSignedIn() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['reservation', 'updatedAt', 'estado']) && isValidReservationUpdate()) ||
                    (isTaller() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['estado', 'statusHistory', 'reparaciones', 'updatedAt']));

      allow create: if isSignedIn() && getUserData().role in ['admin', 'gerente', 'taller'];
      allow delete: if isAdmin();
    }

    match /publicCatalog/{phoneId} {
      // Public read — only projected fields live here
      allow read: if true;
      // Only admin / gerente can write (sync from phones)
      allow write: if isAdminOrGerente();
    }
```

- [ ] **Step 6.4: Create sync script**

Create `scripts/sync-public-catalog.mjs`:

```javascript
// One-shot migration: seed publicCatalog from existing phones.
// Run once: node scripts/sync-public-catalog.mjs
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

const serviceAccount = JSON.parse(
  readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')
);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db
  .collection('phones')
  .where('estado', 'in', ['En Stock (Disponible para Venta)', 'Apartado'])
  .get();

console.log(`Syncing ${snap.size} phones to publicCatalog...`);
const batch = db.batch();
snap.docs.forEach((d) => {
  const p = d.data();
  batch.set(db.collection('publicCatalog').doc(d.id), {
    marca: p.marca,
    modelo: p.modelo,
    storage: p.storage,
    precioVenta: p.precioVenta,
    condition: p.condition,
    imageUrl: p.imageUrl || null,
    estado: p.estado,
    reservation: p.reservation || null,
  });
});
await batch.commit();
console.log('Done.');
```

- [ ] **Step 6.5: Update `usePublicPhones`**

Open `src/features/public/hooks/usePublicPhones.ts` and change the `collection(db, 'phones')` reference to `collection(db, 'publicCatalog')`. The schema maps 1:1 except `costo`/`supplierCode` are absent (they should not have been read anyway — verify by grepping the public feature for `costo` / `supplierCode` use).

- [ ] **Step 6.6: Followup note (separate task, not Week 1)**

Append to `docs/superpowers/plans/2026-04-19-week1-audit-remediation.md` a `## Follow-ups` section: add "Write Firestore Cloud Function `onPhoneWrite` to mirror to `publicCatalog` automatically" so this doesn't drift.

- [ ] **Step 6.7: Run tests**

Run: `npm run test:rules` and `npx vitest run`
Expected: all pass, no regression in regular suite.

- [ ] **Step 6.8: Commit**

```bash
git add firestore.rules scripts/sync-public-catalog.mjs src/features/public/hooks/usePublicPhones.ts src/test/rules/phones.test.ts docs/superpowers/plans/2026-04-19-week1-audit-remediation.md
git commit -m "fix(security): move public catalog into projected collection, remove phones public read"
```

---

## Task 7: pendingOrders create guarded by ownership + status

**Files:**
- Modify: `firestore.rules:127-147`
- Test: `src/test/rules/pendingOrders.test.ts`

- [ ] **Step 7.1: Write failing rules test**

Create `src/test/rules/pendingOrders.test.ts`:

```typescript
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { getEnv, cleanupEnv } from './setup';

beforeAll(async () => { await getEnv(); });
afterAll(async () => { await cleanupEnv(); });

describe('Firestore rules — pendingOrders.create guards', () => {
  beforeEach(async () => { const env = await getEnv(); await env.clearFirestore(); });

  it('buyer CANNOT create order with clientId != own uid', async () => {
    const env = await getEnv();
    const ctx = env.authenticatedContext('buyer-uid-A');
    await assertFails(
      setDoc(doc(ctx.firestore(), 'pendingOrders', 'o1'), {
        clientId: 'someone-else',
        status: 'pending',
        total: 100,
      })
    );
  });

  it('buyer CANNOT create order with status != pending', async () => {
    const env = await getEnv();
    const ctx = env.authenticatedContext('buyer-uid-A');
    await assertFails(
      setDoc(doc(ctx.firestore(), 'pendingOrders', 'o1'), {
        clientId: 'buyer-uid-A',
        status: 'paid',
        total: 100,
      })
    );
  });

  it('buyer CAN create order with own uid + status pending', async () => {
    const env = await getEnv();
    const ctx = env.authenticatedContext('buyer-uid-A');
    await assertSucceeds(
      setDoc(doc(ctx.firestore(), 'pendingOrders', 'o1'), {
        clientId: 'buyer-uid-A',
        status: 'pending',
        total: 100,
      })
    );
  });
});
```

- [ ] **Step 7.2: Run — verify fail**

Run: `npm run test:rules -- src/test/rules/pendingOrders.test.ts`
Expected: first two tests FAIL (current rules accept any signed-in create).

- [ ] **Step 7.3: Fix**

Replace line 134 of `firestore.rules`:

```
      allow create: if isSignedIn() &&
                    request.resource.data.clientId == request.auth.uid &&
                    request.resource.data.status == 'pending';
```

- [ ] **Step 7.4: Run**

Run: `npm run test:rules`
Expected: all three pass.

- [ ] **Step 7.5: Commit**

```bash
git add firestore.rules src/test/rules/pendingOrders.test.ts
git commit -m "fix(security): pendingOrders create requires clientId==uid and status=pending"
```

---

## Task 8: users collection — PII read restricted

**Files:**
- Modify: `firestore.rules:41-44`
- Test: `src/test/rules/users.test.ts`

- [ ] **Step 8.1: Write failing rules test**

Create `src/test/rules/users.test.ts`:

```typescript
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest';
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { getEnv, cleanupEnv } from './setup';

beforeAll(async () => { await getEnv(); });
afterAll(async () => { await cleanupEnv(); });

describe('Firestore rules — users read restricted', () => {
  beforeEach(async () => {
    const env = await getEnv();
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users', 'admin-uid'), {
        email: 'admin@tl.com', role: 'admin', name: 'Admin',
      });
      await setDoc(doc(ctx.firestore(), 'users', 'comprador-uid'), {
        email: 'buyer@tl.com', role: 'comprador', name: 'Buyer',
      });
    });
  });

  it('comprador CANNOT read another user doc', async () => {
    const env = await getEnv();
    const ctx = env.authenticatedContext('comprador-uid');
    await assertFails(getDoc(doc(ctx.firestore(), 'users', 'admin-uid')));
  });

  it('comprador CAN read own doc', async () => {
    const env = await getEnv();
    const ctx = env.authenticatedContext('comprador-uid');
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'users', 'comprador-uid')));
  });

  it('admin CAN read any user doc', async () => {
    const env = await getEnv();
    const ctx = env.authenticatedContext('admin-uid');
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'users', 'comprador-uid')));
  });
});
```

- [ ] **Step 8.2: Run — verify fail**

Run: `npm run test:rules -- src/test/rules/users.test.ts`
Expected: first test FAILS (rules currently allow any signed-in to read all users).

- [ ] **Step 8.3: Fix**

Replace lines 41-44 of `firestore.rules`:

```
    match /users/{userId} {
      allow read: if isSignedIn() && (request.auth.uid == userId || isAdminOrGerente());
      allow write: if isAdmin();
    }
```

**Caveat:** `getUserData()` (used by every other rule) still works because it reads the *requester's own* doc, which the new rule permits.

- [ ] **Step 8.4: Run**

Run: `npm run test:rules`
Expected: all pass.

- [ ] **Step 8.5: Commit**

```bash
git add firestore.rules src/test/rules/users.test.ts
git commit -m "fix(security): users read restricted to own doc or admin/gerente (PII protection)"
```

---

## Integration & Review

- [ ] **Step I.1: Full test sweep**

Run: `npx vitest run && npm run test:rules && npm run build`
Expected: all pass, TypeScript clean.

- [ ] **Step I.2: Request code review**

Invoke superpowers:requesting-code-review skill with reviewer focus: race conditions, rules correctness (especially negative paths), Firestore transaction read-before-write ordering in Task 2 & 4, and ensure the new deterministic IMEI doc IDs in Task 3 don't break any downstream query that uses `doc.id`.

- [ ] **Step I.3: Open PR**

Invoke `/pr` skill. Title: `fix(week1-audit): 8 HIGH/CRITICAL bugs — cart dedupe, oversell, imei uniqueness, receiving txn, authctx memo, public catalog, pendingOrders, users read`. Body lists each bug, file:line, test name. Test plan section per task.

- [ ] **Step I.4: Create Terrance insight via CRM MCP**

Invoke `mcp__vsl-crm__crm_create_insight` with summary "TopLine Tec Week 1 audit — 8 HIGH/CRITICAL bugs remediated, PR #XX", type "audit-result", linked project id = TopLine Tec.

---

## Follow-ups (NOT Week 1, capture as separate tickets)

- Cloud Function `onPhoneWrite` mirror → `publicCatalog` (Task 6 relies on manual sync script)
- BulkSaleDialog double-click guard + dedup (MEDIUM from race audit)
- Receiving rules `reservationService` vs `lockPhonesForPOS` asymmetry (MEDIUM)
- `useRecordDebtPayment` vs `useAddDebtAdjustment` drift — unify increment vs explicit writes
- State-machine validation for `useChangePhoneStatus`
- IMEI `000000000000000` Luhn-passing TAC — `phoneSchema.ts` refinement
- `window.confirm()` → `ConfirmModal` in 4 destructive actions
- `useModal` rollout to ~30 remaining modals
- `SalesHistoryPage` pagination + search debounce
- SEO/OG tags for `/catalogo`
