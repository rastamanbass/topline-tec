# Top Line Tec — Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 critical and 8 high-priority bugs found in the comprehensive audit of the Top Line Tec inventory system.

**Architecture:** All fixes are localized edits to existing files — no new modules. Security fixes target `firestore.rules` and `transactions.ts`. Data integrity fixes target hooks and service files. Performance fixes target lazy-loading patterns.

**Tech Stack:** React 19 + TypeScript + Vite + Firebase 12 + Zustand + TanStack Query

---

## Chunk 1: Critical Fixes (Semana 1)

### Task 1: BUG-1 — Cash sale crash on empty clientId

**Severity:** CRITICAL
**File:** `src/services/firebase/transactions.ts:31`

The POS sale crashes when `clientId` is empty (cash sale with no client selected) because `doc(db, 'clients', '')` creates an invalid Firestore path.

- [ ] **Step 1: Add guard for empty clientId**

In `src/services/firebase/transactions.ts`, wrap the client read in a conditional:

```typescript
// Replace lines 31-45 (the client read + credit check block)
// with a guard that handles cash-no-client sales

let clientName = 'Venta en efectivo';
let currentCredit = 0;

if (saleData.clientId) {
  const clientDoc = await transaction.get(clientRef);
  if (!clientDoc.exists()) throw new Error('Cliente no encontrado.');

  const clientData = clientDoc.data() as Client;
  clientName = clientData.name;
  currentCredit = clientData.creditAmount || 0;

  if (saleData.amountPaidWithCredit > currentCredit) {
    throw new Error('Crédito insuficiente.');
  }
} else {
  // Cash sale without client — no credit/debt allowed
  if (saleData.amountPaidWithCredit > 0) {
    throw new Error('No se puede usar crédito sin un cliente seleccionado.');
  }
  if (saleData.debtIncurred && saleData.debtIncurred > 0) {
    throw new Error('No se puede generar deuda sin un cliente seleccionado.');
  }
}
```

Also guard the `clientRef` creation at line 31:
```typescript
const clientRef = saleData.clientId ? doc(db, 'clients', saleData.clientId) : null;
```

And guard the client credit/debt updates (lines 182-187):
```typescript
if (saleData.amountPaidWithCredit > 0 && clientRef) {
  transaction.update(clientRef, { creditAmount: increment(-round2(saleData.amountPaidWithCredit)) });
}
if (saleData.debtIncurred && saleData.debtIncurred > 0 && clientRef) {
  transaction.update(clientRef, { debtAmount: increment(round2(saleData.debtIncurred)) });
}
```

And guard the purchase record (line 215):
```typescript
if (saleData.clientId) {
  const purchaseRef = doc(collection(db, 'clients', saleData.clientId, 'purchases'));
  transaction.set(purchaseRef, { ... });
}
```

- [ ] **Step 2: Verify build compiles**

Run: `cd /Users/danielabrego/Projects/topline-tec && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/services/firebase/transactions.ts
git commit -m "fix(POS): guard empty clientId to prevent crash on cash sales"
```

---

### Task 2: BUG-2 — Sale never clears reservation field

**Severity:** CRITICAL
**File:** `src/services/firebase/transactions.ts:245-251`

When a phone is sold, the transaction marks it as 'Vendido' but never sets `reservation: null`. This leaves orphan reservation data that can block future operations if the phone is ever re-stocked.

- [ ] **Step 1: Add reservation: null to the phone update**

In `src/services/firebase/transactions.ts`, at line 245-251, add `reservation: null`:

```typescript
transaction.update(phoneRef, {
  estado: 'Vendido',
  clienteId: saleData.clientId || null,
  precioVenta: item.price,
  fechaVenta: new Date().toISOString().slice(0, 10),
  statusHistory: arrayUnion(historyEntry),
  reservation: null, // Clear any POS/B2B reservation
});
```

- [ ] **Step 2: Verify build compiles**

Run: `cd /Users/danielabrego/Projects/topline-tec && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/services/firebase/transactions.ts
git commit -m "fix(POS): clear reservation field when phone is sold"
```

---

### Task 3: SEC-2 — pendingOrders update allows field tampering

**Severity:** CRITICAL
**File:** `firestore.rules:136-141`

A buyer can update ANY field on their own `pendingOrder`, including `total`, `status`, and `items`. They could set `total: 0` and then pay $0.

- [ ] **Step 1: Restrict buyer updates to allowed fields only**

Replace lines 136-143 in `firestore.rules`:

```
      // Buyer can ONLY update payment-related fields on their own order
      // Admin/Gerente can update any field
      allow update: if isSignedIn() && (
        (resource.data.clientId == request.auth.uid &&
         request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'paymentMethod', 'transferDetails', 'updatedAt']) &&
         request.resource.data.status in ['pending_transfer', 'cancelled']
        ) ||
        isAdminOrGerente()
      );
```

This ensures buyers can only:
- Set `status` to `pending_transfer` or `cancelled`
- Set `paymentMethod` and `transferDetails`
- Cannot modify `total`, `items`, `discount`, etc.

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "fix(security): restrict pendingOrders buyer updates to payment fields only"
```

---

### Task 4: BUG-3 — Workshop debt uses stale array indices

**Severity:** CRITICAL
**File:** `src/services/firebase/transactions.ts:76-113`

The workshop debt payment scans `allPhones` (passed from cache) to find unpaid repairs by array index. If the cache is stale, the indices may point to wrong repairs, marking the wrong repair as paid.

The fix: instead of using pre-computed indices from cache, re-read the phone document inside the transaction and recompute which repairs to mark paid by matching on cost + date (not index).

- [ ] **Step 1: Rewrite debt logic to use transaction-read data**

Replace lines 66-113 in `src/services/firebase/transactions.ts`:

```typescript
      const phoneDocsToRead = new Map<string, Record<string, unknown>>();

      // --- Workshop Debt: identify repairs to pay INSIDE the transaction ---
      if (debtToPay > 0 && allPhones.length > 0) {
        // Collect phone IDs that have unpaid repairs (from cache, just for ID discovery)
        const candidatePhoneIds = new Set<string>();
        for (const phone of allPhones) {
          if (phone.reparaciones?.some((r: Repair) => !r.paid && r.cost > 0)) {
            candidatePhoneIds.add(phone.id);
          }
        }

        // Read these phones inside the transaction for fresh data
        for (const pid of candidatePhoneIds) {
          const pRef = doc(db, 'phones', pid);
          const pDoc = await transaction.get(pRef);
          if (pDoc.exists()) {
            phoneDocsToRead.set(pid, pDoc.data());
          }
        }

        // Now build the pending repairs list from FRESH transaction data
        const allPendingRepairs: {
          phoneId: string;
          repairIndex: number;
          cost: number;
          date: Date;
        }[] = [];

        phoneDocsToRead.forEach((data, phoneId) => {
          const repairs = data.reparaciones as Repair[] | undefined;
          if (repairs) {
            repairs.forEach((repair, index) => {
              if (!repair.paid && repair.cost > 0) {
                const repairDate =
                  repair.date instanceof Date
                    ? repair.date
                    : (repair.date as { toDate: () => Date }).toDate();
                allPendingRepairs.push({ phoneId, repairIndex: index, cost: repair.cost, date: repairDate });
              }
            });
          }
        });

        allPendingRepairs.sort((a, b) => a.date.getTime() - b.date.getTime());

        for (const repair of allPendingRepairs) {
          if (debtToPay <= 0) break;
          if (debtToPay >= repair.cost) {
            pendingRepairsToProcess.push(repair);
            debtToPay -= repair.cost;
          }
        }
      }
```

- [ ] **Step 2: Verify build compiles**

Run: `cd /Users/danielabrego/Projects/topline-tec && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/services/firebase/transactions.ts
git commit -m "fix(POS): use transaction-read data for workshop debt indices"
```

---

### Task 5: SEC-1 — Anonymous reservation writes

**Severity:** CRITICAL
**File:** `firestore.rules:55-56`

The phones update rule allows unauthenticated users to write `reservation`, `updatedAt`, and `estado` fields. An attacker could reserve all phones without logging in.

- [ ] **Step 1: Require authentication for reservation updates**

Replace lines 55-57 in `firestore.rules`:

```
      // Reservation updates require authentication
      // Taller can update workshop-specific fields
      allow update: if (isAdmin() || isGerente()) ||
                    (isSignedIn() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['reservation', 'updatedAt', 'estado']) && isValidReservationUpdate()) ||
                    (isTaller() && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['estado', 'statusHistory', 'reparaciones', 'updatedAt']));
```

The key change: added `isSignedIn() &&` before the reservation update condition.

**Impact check:** The B2B catalog flow (`PublicCatalogPage.tsx`) requires users to be signed in before reserving. Anonymous browsing is read-only. This change aligns rules with the intended behavior.

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "fix(security): require auth for phone reservation updates"
```

---

## Chunk 2: High-Priority Fixes (Semana 2)

### Task 6: BUG-4 — Transfer flow never clears phone reservation

**Severity:** HIGH
**File:** `src/features/public/components/CheckoutModal.tsx`

When a buyer selects "Transferencia Bancaria", the checkout writes `status: 'pending_transfer'` to the order but never clears the phone's `reservation` field. The reservation eventually expires, but during that window the phone appears reserved to others.

This is actually correct behavior — the reservation SHOULD remain until the admin confirms the transfer via `markOrderPaid`. No code change needed here; the reservation expiry is the natural cleanup mechanism.

**Decision:** NOT A BUG — Working as designed. Skip.

---

### Task 7: BUG-5 — Sort is a no-op (fechaIngreso instanceof Date)

**Severity:** HIGH
**File:** `src/features/public/hooks/usePublicPhones.ts:27-31`

`fechaIngreso` from Firestore is a `Timestamp`, not a `Date`. The `instanceof Date` check is always false, making the sort a no-op (all values = 0).

- [ ] **Step 1: Fix the sort to handle Firestore Timestamps**

Replace lines 27-31 in `src/features/public/hooks/usePublicPhones.ts`:

```typescript
        .sort((a, b) => {
          const toMs = (v: unknown): number => {
            if (!v) return 0;
            if (typeof (v as { toMillis?: () => number }).toMillis === 'function') return (v as { toMillis: () => number }).toMillis();
            if (v instanceof Date) return v.getTime();
            if (typeof v === 'string') return new Date(v).getTime();
            return 0;
          };
          return toMs(b.fechaIngreso) - toMs(a.fechaIngreso);
        });
```

- [ ] **Step 2: Verify build compiles**

Run: `cd /Users/danielabrego/Projects/topline-tec && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/features/public/hooks/usePublicPhones.ts
git commit -m "fix(catalog): sort phones by fechaIngreso handling Timestamp correctly"
```

---

### Task 8: BUG-6 — invoiceUrl vs invoiceId mismatch

**Severity:** HIGH
**File:** `src/features/public/pages/MyOrdersPage.tsx:270`

The Cloud Function `onOrderPaid` writes `invoiceId` to the order document, but MyOrdersPage checks for `order.invoiceUrl` which is never written. The "Descargar factura" button never appears.

- [ ] **Step 1: Replace invoiceUrl with invoiceId-based download**

In `src/features/public/pages/MyOrdersPage.tsx`, find the interface and the button:

Update the interface (around line 87) — replace `invoiceUrl?: string` with `invoiceId?: string`:
```typescript
  invoiceId?: string;
```

Replace the button block (around lines 270-275):
```typescript
                      {order.invoiceId && (
                        <span
                          className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg font-semibold">
                          Factura #{order.invoiceId.slice(0, 8).toUpperCase()}
                        </span>
                      )}
```

Note: We show the invoice ID as a badge instead of a download link because the invoice PDF generation is admin-side only. Buyers see confirmation that their invoice was created.

- [ ] **Step 2: Verify build compiles**

Run: `cd /Users/danielabrego/Projects/topline-tec && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/features/public/pages/MyOrdersPage.tsx
git commit -m "fix(orders): show invoiceId badge instead of broken invoiceUrl link"
```

---

### Task 9: BUG-7 — FloatingCart countdown never decrements

**Severity:** HIGH
**File:** `src/features/public/pages/PublicCatalogPage.tsx`

The `timeLeft` prop passed to FloatingCart is hardcoded as `30 * 60 * 1000` and never updates. The countdown appears static.

- [ ] **Step 1: Find and read PublicCatalogPage to locate the FloatingCart usage**

Read `src/features/public/pages/PublicCatalogPage.tsx` to understand how `FloatingCart` is rendered and where `timeLeft` comes from. We need to add a countdown timer state.

- [ ] **Step 2: Add countdown state in PublicCatalogPage**

Add a `useEffect`-based countdown that computes remaining time from the earliest reservation's `expiresAt`:

```typescript
// Add near the top of the component, after reservedPhones is computed
const [now, setNow] = useState(Date.now());

useEffect(() => {
  if (myReservedPhones.length === 0) return;
  const interval = setInterval(() => setNow(Date.now()), 1000);
  return () => clearInterval(interval);
}, [myReservedPhones.length]);

// Compute timeLeft from the earliest reservation expiry
const earliestExpiry = myReservedPhones.reduce((min, phone) => {
  const exp = phone.reservation?.expiresAt ?? Infinity;
  return exp < min ? exp : min;
}, Infinity);
const timeLeft = Math.max(0, earliestExpiry - now);
```

Then pass the computed `timeLeft` to `FloatingCart` instead of the hardcoded value.

- [ ] **Step 3: Verify build compiles**

Run: `cd /Users/danielabrego/Projects/topline-tec && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/features/public/pages/PublicCatalogPage.tsx
git commit -m "fix(catalog): compute real countdown from reservation expiresAt"
```

---

### Task 10: BUG-8 — Debt adjustment never updates debtAmount

**Severity:** HIGH
**File:** `src/features/clients/hooks/useClients.ts:289-312`

`useAddDebtAdjustment` creates an audit record in the `debtAdjustments` subcollection but never increments/decrements `client.debtAmount`. The adjustment is recorded but has no effect.

- [ ] **Step 1: Add atomic debtAmount update**

Replace the `mutationFn` in `useAddDebtAdjustment` (lines 291-310):

```typescript
  return useMutation({
    mutationFn: async ({
      clientId,
      amount,
      reason,
      adjustedBy,
    }: {
      clientId: string;
      amount: number;
      reason: string;
      adjustedBy: string;
    }) => {
      const clientRef = doc(db, 'clients', clientId);
      const adjustmentRef = doc(collection(db, 'clients', clientId, 'debtAdjustments'));

      await runTransaction(db, async (transaction) => {
        const clientDoc = await transaction.get(clientRef);
        if (!clientDoc.exists()) throw new Error('Cliente no encontrado.');

        // Create the audit record
        transaction.set(adjustmentRef, {
          amount,
          reason,
          adjustedBy,
          adjustedAt: serverTimestamp(),
        });

        // Update the scalar debtAmount atomically
        transaction.update(clientRef, {
          debtAmount: increment(amount),
        });
      });
    },
  });
```

Need to add `runTransaction` and `increment` to the imports at the top of the file.

- [ ] **Step 2: Add missing imports**

Add `runTransaction` and `increment` to the firebase/firestore import at the top of `useClients.ts`:

```typescript
import { ..., runTransaction, increment } from 'firebase/firestore';
```

- [ ] **Step 3: Verify build compiles**

Run: `cd /Users/danielabrego/Projects/topline-tec && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/features/clients/hooks/useClients.ts
git commit -m "fix(clients): atomically update debtAmount on debt adjustment"
```

---

### Task 11: BUG-9 — useSales downloads ALL phones on cache miss

**Severity:** HIGH
**File:** `src/features/sales/hooks/useSales.ts:16-19`

When the TanStack Query cache doesn't have a `phones` entry (e.g., first POS sale after page refresh), `useSaleTransaction` downloads ALL 2,400+ phone documents. This is expensive and slow.

The root cause: workshop debt logic in `transactions.ts` needs `allPhones` to find unpaid repairs. But Task 4 already reads repair phones inside the transaction. We can now limit the cache fallback to only phones with unpaid repairs.

- [ ] **Step 1: Query only phones with unpaid repairs instead of all phones**

Replace lines 12-22 in `src/features/sales/hooks/useSales.ts`:

```typescript
    mutationFn: async (saleData: SaleData) => {
      // For workshop debt: only need phones with repairs, not ALL phones
      let allPhones: Phone[] = [];

      if (saleData.amountPaidWithWorkshopDebt > 0) {
        // Try cache first
        const cached = queryClient.getQueryData<Phone[]>(['phones', {}]);
        if (cached) {
          allPhones = cached;
        } else {
          // Fallback: query only phones that have repairs array (much smaller set)
          const q = query(
            collection(db, 'phones'),
            where('reparaciones', '!=', null)
          );
          const snapshot = await getDocs(q);
          allPhones = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) as Phone[];
        }
      }

      return executeSaleTransaction(saleData, allPhones);
    },
```

Add `where` to the imports:
```typescript
import { collection, getDocs, query, where } from 'firebase/firestore';
```

- [ ] **Step 2: Verify build compiles**

Run: `cd /Users/danielabrego/Projects/topline-tec && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/features/sales/hooks/useSales.ts
git commit -m "perf(POS): only fetch phones with repairs instead of entire inventory"
```

---

### Task 12: BUG-10 — ScanToSell stale closure on cartItems

**Severity:** HIGH
**File:** `src/features/inventory/components/ScanToSell.tsx:96`

`cartItems` is captured in the `useCallback` dependency array, but when scanning rapidly the closure may hold a stale `cartItems.length`. The `openPaymentModal()` may fire multiple times or not at all.

- [ ] **Step 1: Use Zustand getState() instead of closure**

In `src/features/inventory/components/ScanToSell.tsx`, replace the stale closure check at line 96:

```typescript
        // Auto-open payment modal on first item — use getState() to avoid stale closure
        if (useSalesStore.getState().cartItems.length === 0) {
          openPaymentModal();
        }
```

Also remove `cartItems` from the `useCallback` dependency array (line 106) since we no longer depend on it for the modal check. Keep it only for the duplicate check:

Actually, the duplicate check at line 48 also uses `cartItems` from closure. Let's fix both:

```typescript
      // Check if already in cart — read fresh state
      const currentCart = useSalesStore.getState().cartItems;
      if (currentCart.some((item) => item.imei === imei)) {
        toast('Este teléfono ya está en el carrito', { icon: '⚠️' });
        return;
      }
```

And update the dependency array:
```typescript
  [addToCart, openPaymentModal]
```

- [ ] **Step 2: Verify build compiles**

Run: `cd /Users/danielabrego/Projects/topline-tec && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/features/inventory/components/ScanToSell.tsx
git commit -m "fix(scanner): use getState() to avoid stale cartItems closure"
```

---

### Task 13: BUG-13 — unlockPhonesFromPOS hardcodes estado

**Severity:** HIGH
**File:** `src/services/firebase/stockLock.ts:117-119`

When a POS sale is cancelled, `unlockPhonesFromPOS` sets `estado: 'En Stock (Disponible para Venta)'` regardless of the phone's previous estado. A phone that was 'Apartado' (reserved by B2B buyer) before the POS lock would incorrectly become 'En Stock'.

However, looking at the code more carefully: the guard at line 116 only clears if `reservation.reservedBy === 'POS_SALE'`. And `lockPhonesForPOS` only locks phones that are 'En Stock' (it rejects 'Apartado' phones at line 42-49). So unlocking back to 'En Stock' is correct for the POS flow.

**Decision:** NOT A BUG in practice — the lock only takes 'En Stock' phones, so unlock back to 'En Stock' is correct. The B2B guard prevents cross-contamination. Skip.

---

## Final: Build and Deploy

### Task 14: Build, lint, and deploy

- [ ] **Step 1: Run TypeScript check**

```bash
cd /Users/danielabrego/Projects/topline-tec && npx tsc --noEmit
```

- [ ] **Step 2: Run build**

```bash
cd /Users/danielabrego/Projects/topline-tec && npm run build
```

- [ ] **Step 3: Deploy**

```bash
cd /Users/danielabrego/Projects/topline-tec && firebase deploy --only hosting
```

- [ ] **Step 4: Verify in browser**

Open https://inventario-a6aa3.web.app and test:
1. POS cash sale without client → should not crash
2. B2B catalog → phones sorted by date
3. MyOrders → invoice badge shows for paid orders
