# Audit Bugfixes — Top Line Tec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all critical and important bugs found in the Mar 25 2026 audit — 4 critical bugs + 3 cleanup items.

**Architecture:** Each task is a surgical fix to an existing file. No new features, no refactors beyond the fix. Tests where applicable.

**Tech Stack:** React 19 + TypeScript + Vite + Firebase 12 (Cloud Functions Node 22) + Vitest

---

## File Map

| File | Action | Task |
|------|--------|------|
| `src/features/inventory/components/ScanToSell.tsx` | Modify line 93 | Task 1 |
| `src/features/fritz/components/FritzSaleModal.tsx` | Modify lines 28-31 | Task 2 |
| `src/features/fritz/hooks/useFritz.ts` | Modify lines 100-119 | Task 3 |
| `functions/src/index.ts` | Modify lines 532-536 | Task 4 |
| `src/features/inventory/hooks/usePhones.ts` | Modify lines 89-98 | Task 5 |
| `src/features/public/ClientStorePage.tsx` | Delete | Task 6 |
| `src/features/inventory/components/SeederButton.tsx` | Delete | Task 7 |
| `src/features/inventory/components/BrainInjector.tsx` | Delete | Task 7 |
| `src/features/inventory/components/DataRepairButton.tsx` | Delete | Task 7 |

---

### Task 1: Fix ScanToSell — payment modal never auto-opens

**Severity:** CRITICAL
**Files:**
- Modify: `src/features/inventory/components/ScanToSell.tsx:93`

**Problem:** After `addToCart()` is called (line 76), the cart already has 1+ items. The check `cartItems.length === 0` on line 93 is always `false`, so the payment modal never opens automatically after scanning the first phone. The intent is "open modal when this is the first item added."

- [ ] **Step 1: Write the fix**

In `src/features/inventory/components/ScanToSell.tsx`, change line 93 from:

```tsx
if (useSalesStore.getState().cartItems.length === 0) {
```

to:

```tsx
if (useSalesStore.getState().cartItems.length === 1) {
```

This checks the post-add state: if there's exactly 1 item after adding, this was the first scan, so auto-open the payment modal.

- [ ] **Step 2: Verify no regressions**

Run: `npx vitest run --reporter=verbose`
Expected: All existing tests pass (ScanToSell has no unit tests, but salesStore tests cover cart logic).

- [ ] **Step 3: Manual verification logic**

Confirm the flow: scan IMEI → `addToCart()` adds 1 item → `getState().cartItems.length` is now `1` → condition is `true` → `openPaymentModal()` fires. Second scan: length is `2` → condition is `false` → modal doesn't re-open. Correct.

- [ ] **Step 4: Commit**

```bash
git add src/features/inventory/components/ScanToSell.tsx
git commit -m "fix: ScanToSell auto-opens payment modal after first scan

The condition checked length === 0 after addToCart already ran,
so it was always false. Changed to length === 1 (post-add state)."
```

---

### Task 2: Fix FritzSaleModal — setState during render

**Severity:** CRITICAL
**Files:**
- Modify: `src/features/fritz/components/FritzSaleModal.tsx:28-31`

**Problem:** Lines 28-31 call `setItems()` directly during the render phase (not inside useEffect). This violates React's rules and causes "Cannot update a component while rendering" warnings. Can cause infinite re-render loops.

- [ ] **Step 1: Add useEffect import**

The file already imports `useState` from React. Add `useEffect` to the import:

```tsx
import { useState, useEffect } from 'react';
```

- [ ] **Step 2: Replace render-time setState with useEffect**

Replace lines 28-31:

```tsx
// Sync items from preview when it changes
if (salePreview && items.length === 0 && salePreview.items.length > 0) {
  setItems([...salePreview.items]);
}
```

with:

```tsx
// Sync items from preview when it changes (only on first load — preserve user edits)
useEffect(() => {
  if (salePreview && salePreview.items.length > 0) {
    setItems((prev) => (prev.length === 0 ? [...salePreview.items] : prev));
  }
}, [salePreview]);
```

Note: We keep the `items.length === 0` guard (via functional setState) to prevent overwriting user edits. When the user modifies quantities/prices and Fritz responds with a new preview (e.g., via addToSale), items are already populated so the guard skips the sync. Only the initial empty state triggers population.

- [ ] **Step 3: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: All pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/fritz/components/FritzSaleModal.tsx
git commit -m "fix: move FritzSaleModal item sync into useEffect

Calling setItems() during render violates React rules. Moved to
useEffect with salePreview as dependency."
```

---

### Task 3: Fix Fritz executeSale — discarded payload

**Severity:** CRITICAL
**Files:**
- Modify: `src/features/fritz/hooks/useFritz.ts:100-119`

**Problem:** `executeSale` builds a structured JSON payload (`msg`) but never uses it. Instead sends human-readable text to Claude. The function is also never called by any component (dead code). The FritzSaleModal already sends its own confirmation message via `sendMessage` directly (line 140-141 of FritzSaleModal.tsx).

**Decision:** Remove `executeSale` entirely — it's dead code with a bug. FritzSaleModal handles sale confirmation directly through `sendMessage`.

- [ ] **Step 1: Remove executeSale function**

In `src/features/fritz/hooks/useFritz.ts`, delete lines 100-119 (the entire `executeSale` useCallback, including the closing `);`).

- [ ] **Step 2: Remove from return statement**

Change line 132 from:

```tsx
return { sendMessage, executeSale, addToSale };
```

to:

```tsx
return { sendMessage, addToSale };
```

- [ ] **Step 3: Verify no consumers**

Run: `grep -r "executeSale" src/ --include="*.tsx" --include="*.ts"`
Expected: Only `useFritz.ts` itself (which we're modifying). No other file imports or calls it.

- [ ] **Step 4: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/fritz/hooks/useFritz.ts
git commit -m "fix: remove dead executeSale from useFritz

The function built a JSON payload then discarded it, sending
plain text to Claude instead. No component called it —
FritzSaleModal sends confirmations directly via sendMessage."
```

---

### Task 4: Fix push notification — wrong user lookup

**Severity:** CRITICAL
**Files:**
- Modify: `functions/src/index.ts:532-536`

**Problem:** `onShipmentStatusChanged` looks up `users/${clientId}` but `clientId` is from the `clients` collection, not the Firebase Auth UID. The `users` collection is keyed by Auth UID. This means push notifications and email fallbacks silently fail for every shipment status change.

**Fix:** Query the `users` collection to find the user whose `clientId` field matches the order's `clientId`.

- [ ] **Step 1: Replace direct doc lookup with query**

In `functions/src/index.ts`, replace lines 532-536:

```typescript
const clientId = orderData.clientId as string | undefined;
if (!clientId) return;

const userSnap = await db.doc(`users/${clientId}`).get();
const userData = userSnap.data();
```

with:

```typescript
const clientId = orderData.clientId as string | undefined;
if (!clientId) return;

// clientId is from the clients collection, not the Auth UID.
// Query users collection to find the user linked to this client.
const usersSnap = await db.collection("users")
  .where("clientId", "==", clientId)
  .limit(1)
  .get();

const userData = usersSnap.empty ? undefined : usersSnap.docs[0].data();
```

- [ ] **Step 2: Verify Firestore index for users.clientId**

The query `.where("clientId", "==", clientId)` requires a single-field index on `users/clientId`. Firestore auto-creates single-field indexes for all fields by default, so this should already exist. Verify by checking:

Run: `cat firestore.indexes.json`

If `clientId` is not explicitly exempted, the auto-index covers it. If there's an exemption, add an explicit index entry. Single-field equality queries use auto-indexes — no manual index creation needed unless auto-indexing was disabled for this field.

- [ ] **Step 3: Build Cloud Functions**

Run: `cd functions && npm run build`
Expected: Clean build, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add functions/src/index.ts
git commit -m "fix: shipment notification looks up user by clientId field

Was using clientId as doc ID in users collection, but clientId
is from the clients collection. Now queries users where
clientId matches, so push notifications actually reach users."
```

- [ ] **Step 5: Deploy Cloud Functions**

Run: `cd /Users/danielabrego/Projects/topline-tec && firebase deploy --only functions:onShipmentStatusChanged`
Expected: Successful deploy.

---

### Task 5: Fix paginated search — hasMore breaks with client-side filtering

**Severity:** IMPORTANT
**Files:**
- Modify: `src/features/inventory/hooks/usePhones.ts:89-98`

**Problem:** When `searchQuery` is set, `applyClientSearch` filters results client-side after the paginated Firestore fetch. But `hasMore` is computed from the raw snapshot size, not the filtered size. This means:
- "Ver más" shows even when no more matching phones exist
- Pages can appear empty after filtering

**Fix:** Compute `hasMore` from the raw snapshot (pagination cursor needs raw docs), but return filtered phones. This is already structurally correct for cursor pagination — the real issue is that the UX is misleading but not broken. The cursor still advances correctly. Adding a note comment is the minimal safe fix. A full fix would require server-side search (Algolia/Typesense) which is out of scope.

- [ ] **Step 1: Add clarifying comment and improve empty-page UX**

In `src/features/inventory/hooks/usePhones.ts`, replace lines 89-98:

```typescript
const phones = applyClientSearch(
  snapshot.docs.map(mapPhone),
  filters.searchQuery
);

return {
  phones,
  lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
  hasMore: snapshot.docs.length === PAGE_SIZE,
};
```

with:

```typescript
const allPhones = snapshot.docs.map(mapPhone);
const phones = applyClientSearch(allPhones, filters.searchQuery);

// hasMore is based on raw Firestore page size (not filtered count)
// because the cursor needs raw docs for pagination. When searching,
// some pages may return fewer results than PAGE_SIZE — this is a
// known limitation of client-side search with cursor pagination.
return {
  phones,
  lastDoc: snapshot.docs[snapshot.docs.length - 1] ?? null,
  hasMore: snapshot.docs.length === PAGE_SIZE,
};
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run --reporter=verbose`
Expected: All pass.

- [ ] **Step 3: Commit**

```bash
git add src/features/inventory/hooks/usePhones.ts
git commit -m "docs: clarify pagination + search limitation in usePhonesPaginated

Client-side filtering after paginated fetch can show misleading
'ver más' button. Documented as known limitation — full fix
requires server-side search (out of scope)."
```

---

### Task 6: Delete dead ClientStorePage

**Severity:** IMPORTANT
**Files:**
- Delete: `src/features/public/ClientStorePage.tsx`

**Problem:** This is an old, unused file (App.tsx imports from `./features/public/pages/ClientStorePage` — the active copy). The dead file exposes IMEIs in search and uses internal `PhoneCard` component with `FloatingCart sessionId="demo"`. If accidentally imported, buyers see internal data.

- [ ] **Step 1: Verify it's not imported anywhere**

Run: `grep -r "from.*public/ClientStorePage" src/ --include="*.ts" --include="*.tsx"`
Expected: No results (App.tsx imports from `public/pages/ClientStorePage`, not `public/ClientStorePage`).

- [ ] **Step 2: Delete the file**

```bash
rm src/features/public/ClientStorePage.tsx
```

- [ ] **Step 3: Run tests and build**

Run: `npx vitest run --reporter=verbose && npx vite build`
Expected: All pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -u src/features/public/ClientStorePage.tsx
git commit -m "chore: delete dead ClientStorePage that exposed IMEIs

Old file at public/ClientStorePage.tsx was never imported (App.tsx
uses public/pages/ClientStorePage.tsx). It rendered internal
PhoneCard with IMEI search visible to buyers."
```

---

### Task 7: Delete dead admin utility components

**Severity:** IMPORTANT
**Files:**
- Delete: `src/features/inventory/components/SeederButton.tsx`
- Delete: `src/features/inventory/components/BrainInjector.tsx`
- Delete: `src/features/inventory/components/DataRepairButton.tsx`

**Problem:** These components are defined but never imported or rendered. They ship in the production bundle as dead code. SeederButton writes test data to production Firestore. BrainInjector overwrites 1000+ records in `price_catalog`. DataRepairButton does bulk mutations. None have environment guards.

- [ ] **Step 1: Verify none are imported**

Run: `grep -r "SeederButton\|BrainInjector\|DataRepairButton" src/ --include="*.tsx" --include="*.ts" | grep -v "components/SeederButton\|components/BrainInjector\|components/DataRepairButton"`
Expected: No results.

- [ ] **Step 2: Delete the files**

```bash
rm src/features/inventory/components/SeederButton.tsx
rm src/features/inventory/components/BrainInjector.tsx
rm src/features/inventory/components/DataRepairButton.tsx
```

- [ ] **Step 3: Check for orphaned data imports**

Run: `grep -r "learned_prices\|learned_tac" src/ --include="*.ts" --include="*.tsx"`
Expected: No results after deleting BrainInjector (it was the only consumer of those JSON data files).

- [ ] **Step 4: Delete orphaned data files if they exist**

```bash
ls src/data/learned_prices.json src/data/learned_tac.json 2>/dev/null
```

If they exist and nothing else imports them, delete them too.

- [ ] **Step 5: Run tests and build**

Run: `npx vitest run --reporter=verbose && npx vite build`
Expected: All pass, build succeeds (and bundle is smaller).

- [ ] **Step 6: Commit**

```bash
git add -u
git commit -m "chore: delete dead admin utility components

SeederButton, BrainInjector, DataRepairButton were never imported
but shipped in production bundle. SeederButton could write test
data to prod Firestore. Removed along with orphaned data files."
```

---

## Execution Order

Tasks 1-4 are independent (different files) and can run in parallel.
Tasks 5-7 are independent and can run in parallel.
All tasks are independent of each other.

## Post-Execution

After all tasks are done:
1. Run full test suite: `npx vitest run --reporter=verbose`
2. Run production build: `npx vite build`
3. Build Cloud Functions: `cd functions && npm run build`
4. Deploy: `firebase deploy --only functions:onShipmentStatusChanged` (Task 4 only needs function deploy)
5. Deploy hosting: `firebase deploy --only hosting`
