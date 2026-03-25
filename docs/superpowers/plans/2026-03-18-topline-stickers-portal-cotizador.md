# Top Line Tec — Stickers, Portal, Cotizador, CECOT & Web Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Top Line Tec complete phone tracking with printed stickers (barcode + QR), an internal phone detail portal, a live pre-purchase cotizador, CECOT seizure handling, and a new toplinetec.net marketing website.

**Architecture:** Five independent modules built on the existing React 19 + Firebase + TailwindCSS stack. Stickers generate printable labels with JsBarcode + qrcode.react. Portal is a new protected route `/phone/:imei` showing full phone detail. Cotizador is a cart-like builder with live totals and audit trail. CECOT adds a `seized` field to phones and filters them from all business queries. The .net site is a standalone Astro static site.

**Tech Stack:** React 19, TypeScript, Vite, Firebase 12 (Firestore), TailwindCSS 4, JsBarcode (new), qrcode.react (existing), jsPDF (existing), Astro (new, .net site only), Vitest

**Team (conceptual specializations):**
- **Eng 1 — Data & Backend** (Firestore schema, queries, filters): Chunks 1-2
- **Eng 2 — Frontend Components** (UI, print layout, labels): Chunks 3-4
- **Eng 3 — UX & Flows** (cotizador interaction, cart logic): Chunk 5
- **Eng 4 — Marketing & Web** (Astro site, SEO, branding): Chunk 6

**Existing patterns to follow:**
- Features live in `src/features/<name>/` with `components/`, `hooks/`, `pages/` subdirs
- Hooks use `@tanstack/react-query` with `useQuery`/`useMutation`
- Types in `src/types/index.ts`
- Routes in `src/App.tsx` wrapped by `<ProtectedRoute allowedRoles={[...]}>`
- Tests in `__tests__/` colocated with source, using Vitest + jsdom
- `vi.mock('firebase/firestore')` pattern for all Firebase-dependent tests
- PDF generation via jsPDF in `src/services/pdf/`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/features/labels/components/PhoneStickerLabel.tsx` | Single sticker layout (barcode + QR + info) |
| `src/features/labels/components/StickerPrintView.tsx` | Full-page print view for batch of stickers |
| `src/features/labels/hooks/usePhoneStickers.ts` | Data fetching for sticker generation |
| `src/features/labels/__tests__/stickerUtils.test.ts` | Barcode/QR URL generation tests |
| `src/features/labels/utils/stickerUtils.ts` | Pure functions: buildTrackingUrl, formatStickerInfo |
| `src/features/phone-portal/PhonePortalPage.tsx` | Internal phone detail page at `/phone/:imei` |
| `src/features/phone-portal/hooks/usePhoneByImei.ts` | Fetch phone by IMEI from Firestore |
| `src/features/phone-portal/__tests__/usePhoneByImei.test.ts` | Query logic tests |
| `src/features/cotizador/CotizadorPage.tsx` | Pre-purchase builder page |
| `src/features/cotizador/components/CotizadorCart.tsx` | Cart UI with live totals |
| `src/features/cotizador/components/CotizadorSearch.tsx` | IMEI search/scanner input |
| `src/features/cotizador/components/CotizadorAuditLog.tsx` | Removed items log |
| `src/features/cotizador/hooks/useCotizador.ts` | Cart state management (Zustand store) |
| `src/features/cotizador/__tests__/useCotizador.test.ts` | Cart logic tests |

### Modified Files
| File | Change |
|------|--------|
| `src/types/index.ts` | Add `seized?: boolean`, `seizedReason?: string`, `seizedDate?: string` to Phone |
| `src/App.tsx` | Add routes: `/phone/:imei`, `/cotizador`, `/labels/:lote` |
| `src/components/layout/BottomNav.tsx` | Add Cotizador to MORE_ITEMS |
| `src/features/dashboard/hooks/useDashboardStats.ts` | Exclude seized phones from all counts |
| `src/features/inventory/components/PhoneDetailsModal.tsx` | Add "Marcar como Inhabilitado" button, sticker print button |
| `src/features/receiving/ReceivingPage.tsx` | Add "Imprimir Stickers" button after closing reception |
| `src/features/receiving/hooks/useReceivingSession.ts` | Skip seized phones in processScan |
| `src/features/inventory/hooks/usePhones.ts` | Add seized filter option |
| `package.json` | Add `jsbarcode` dependency |

---

## Chunk 1: CECOT — Seized Phone Handling

**Engineer:** Data & Backend
**Estimated tasks:** 4
**Dependencies:** None (this is the foundation — must be done first)

### Task 1.1: Add seized fields to Phone type

**Files:**
- Modify: `src/types/index.ts:11-38`
- Test: `src/lib/__tests__/phoneUtils.test.ts` (add seized tests)

- [ ] **Step 1: Add seized fields to Phone interface**

In `src/types/index.ts`, add these fields to the `Phone` interface after line 30 (`photos`):

```typescript
  seized?: boolean;           // true = phone confiscated (CECOT, customs, etc.)
  seizedReason?: string;      // "CECOT", "Aduana", etc.
  seizedDate?: string;        // ISO date when seized
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (fields are optional so existing code is unaffected)

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add seized fields to Phone type for CECOT handling"
```

---

### Task 1.2: Filter seized phones from dashboard stats

**Files:**
- Modify: `src/features/dashboard/hooks/useDashboardStats.ts`
- Test: `src/features/dashboard/__tests__/useDashboardStats.test.ts`

- [ ] **Step 1: Write test for seized phone exclusion**

Add to `src/features/dashboard/__tests__/useDashboardStats.test.ts`:

```typescript
describe('seized phone filtering', () => {
  it('excludes seized phones from inStock count', () => {
    const phones = [
      { estado: 'En Stock (Disponible para Venta)', seized: false },
      { estado: 'En Stock (Disponible para Venta)', seized: true },
      { estado: 'En Stock (Disponible para Venta)' }, // no seized field = not seized
    ];
    const filtered = phones.filter(p => !p.seized);
    expect(filtered).toHaveLength(2);
  });

  it('counts seized phones separately', () => {
    const phones = [
      { seized: true, seizedReason: 'CECOT' },
      { seized: true, seizedReason: 'Aduana' },
      { estado: 'En Stock (Disponible para Venta)' },
    ];
    const seizedCount = phones.filter(p => p.seized).length;
    expect(seizedCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/features/dashboard/__tests__/useDashboardStats.test.ts`
Expected: PASS (these are pure filter logic tests)

- [ ] **Step 3: Add `seized` filter to dashboard Firestore queries**

In `src/features/dashboard/hooks/useDashboardStats.ts`, every `where('estado', ...)` query must also add `where('seized', '!=', true)`.

**IMPORTANT:** Firestore doesn't allow `!=` combined with `in` on different fields in the same query. Instead, the cleanest approach is to **filter client-side** after fetching:

Find each `getCountFromServer` and `getAggregateFromServer` call. After each result, the counts are already server-side so we cannot easily add seized filtering there. Instead, add a **separate seized count query** at the end:

```typescript
// Add after all existing queries (around line 300):
// ── Seized phones (excluded from all business metrics) ──
const seizedQuery = query(
  collection(db, 'phones'),
  where('seized', '==', true)
);
const seizedSnap = await getCountFromServer(seizedQuery);
const seizedCount = seizedSnap.data().count;
```

Then return `seizedCount` in the stats object. Subtract seized from any raw counts that might include them.

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/hooks/useDashboardStats.ts src/features/dashboard/__tests__/useDashboardStats.test.ts
git commit -m "feat: exclude seized phones from dashboard stats, add seized count"
```

---

### Task 1.3: Add "Marcar como Inhabilitado" to PhoneDetailsModal

**Files:**
- Modify: `src/features/inventory/components/PhoneDetailsModal.tsx`

- [ ] **Step 1: Read the current PhoneDetailsModal**

Read: `src/features/inventory/components/PhoneDetailsModal.tsx`
Understand the edit/delete button patterns and state management.

- [ ] **Step 2: Add seized toggle button**

After the existing action buttons (edit/delete), add:

```tsx
{/* Seized toggle — admin only */}
{userRole === 'admin' && (
  <button
    onClick={async () => {
      const phoneRef = doc(db, 'phones', phone.id);
      if (phone.seized) {
        // Un-seize
        await updateDoc(phoneRef, {
          seized: false,
          seizedReason: null,
          seizedDate: null,
          updatedAt: serverTimestamp(),
        });
        toast.success('Teléfono rehabilitado');
      } else {
        // Seize
        const reason = prompt('Razón (ej: CECOT, Aduana):');
        if (!reason) return;
        await updateDoc(phoneRef, {
          seized: true,
          seizedReason: reason,
          seizedDate: new Date().toISOString().split('T')[0],
          updatedAt: serverTimestamp(),
        });
        toast.success('Teléfono marcado como inhabilitado');
      }
      onClose();
      queryClient.invalidateQueries({ queryKey: ['phones'] });
    }}
    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
      phone.seized
        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
        : 'bg-red-100 text-red-700 hover:bg-red-200'
    }`}
  >
    <ShieldOff className="w-4 h-4" />
    {phone.seized ? 'Rehabilitar' : 'Inhabilitar (CECOT)'}
  </button>
)}
```

Also add visual indicator at top of modal when phone is seized:

```tsx
{phone.seized && (
  <div className="bg-red-100 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800 font-semibold flex items-center gap-2">
    <ShieldOff className="w-5 h-5" />
    INHABILITADO — {phone.seizedReason} ({phone.seizedDate})
  </div>
)}
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`
Open inventory, click any phone → verify button appears for admin role.

- [ ] **Step 4: Commit**

```bash
git add src/features/inventory/components/PhoneDetailsModal.tsx
git commit -m "feat: add seized/inhabilitado toggle to phone details (admin only)"
```

---

### Task 1.4: Filter seized phones from receiving scan

**Files:**
- Modify: `src/features/receiving/hooks/useReceivingSession.ts`

- [ ] **Step 1: Modify processScan to skip seized phones**

In `useReceivingSession.ts`, find where `transitImeis` Map is built (the `useQuery` that fetches phones for the selected lote). Add filter to exclude seized phones when building the Map:

```typescript
// When building transitImeis Map, skip seized phones:
const transitImeis = new Map<string, Phone>();
phonesInLote.forEach(phone => {
  if (phone.seized) return; // Skip seized phones
  if (phone.estado === 'En Tránsito (a El Salvador)') {
    transitImeis.set(phone.imei, phone);
  }
});
```

- [ ] **Step 2: Run receiving tests**

Run: `npx vitest run src/features/receiving/hooks/__tests__/useReceivingSession.test.ts`
Expected: All 18 tests pass (seized filter is in the hook layer, not the pure scan logic)

- [ ] **Step 3: Commit**

```bash
git add src/features/receiving/hooks/useReceivingSession.ts
git commit -m "feat: exclude seized phones from receiving scan flow"
```

---

## Chunk 2: Internal Phone Portal — `/phone/:imei`

**Engineer:** Data & Backend + Frontend
**Estimated tasks:** 4
**Dependencies:** Chunk 1 (uses seized field for UI indicator)

### Task 2.1: Create usePhoneByImei hook

**Files:**
- Create: `src/features/phone-portal/hooks/usePhoneByImei.ts`
- Create: `src/features/phone-portal/__tests__/usePhoneByImei.test.ts`

- [ ] **Step 1: Write the test**

Create `src/features/phone-portal/__tests__/usePhoneByImei.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../../lib/firebase', () => ({
  db: {},
}));

const mockGetDocs = vi.fn();

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  limit: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryFn, enabled }) => {
    if (enabled === false) return { data: null, isLoading: false };
    return { data: null, isLoading: true };
  }),
}));

import { buildPhoneQuery } from '../hooks/usePhoneByImei';

describe('usePhoneByImei', () => {
  beforeEach(() => vi.clearAllMocks());

  it('validates IMEI must be at least 8 digits', () => {
    expect(buildPhoneQuery('123')).toBeNull();
    expect(buildPhoneQuery('')).toBeNull();
  });

  it('strips non-digit characters from IMEI', () => {
    const result = buildPhoneQuery('356-371-101-234-567');
    expect(result).toBe('356371101234567');
  });

  it('normalizes GS1 16-digit barcode', () => {
    const result = buildPhoneQuery('1356371101234567');
    expect(result).toBe('356371101234567');
  });

  it('accepts valid 15-digit IMEI', () => {
    const result = buildPhoneQuery('356371101234567');
    expect(result).toBe('356371101234567');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/phone-portal/__tests__/usePhoneByImei.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the hook**

Create `src/features/phone-portal/hooks/usePhoneByImei.ts`:

```typescript
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Phone } from '../../../types';

/** Pure function: normalize IMEI for query. Returns null if invalid. */
export function buildPhoneQuery(raw: string): string | null {
  const digits = raw.trim().replace(/\D/g, '');
  if (digits.length < 8) return null;

  // GS1 normalization
  if (digits.length === 16 && digits[0] === '1') {
    return digits.substring(1);
  }
  return digits;
}

export function usePhoneByImei(rawImei: string) {
  const normalizedImei = buildPhoneQuery(rawImei);

  return useQuery({
    queryKey: ['phone-by-imei', normalizedImei],
    enabled: !!normalizedImei,
    queryFn: async (): Promise<Phone | null> => {
      if (!normalizedImei) return null;

      const q = query(
        collection(db, 'phones'),
        where('imei', '==', normalizedImei),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;

      const doc = snap.docs[0];
      return { id: doc.id, ...doc.data() } as Phone;
    },
    staleTime: 30_000,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/phone-portal/__tests__/usePhoneByImei.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/phone-portal/
git commit -m "feat: add usePhoneByImei hook with GS1 normalization"
```

---

### Task 2.2: Create PhonePortalPage component

**Files:**
- Create: `src/features/phone-portal/PhonePortalPage.tsx`

- [ ] **Step 1: Create the portal page**

Create `src/features/phone-portal/PhonePortalPage.tsx`:

```tsx
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Smartphone,
  Package,
  ShieldOff,
  Truck,
  CheckCircle2,
  Clock,
  Wrench,
  AlertTriangle,
  Printer,
} from 'lucide-react';
import { usePhoneByImei } from './hooks/usePhoneByImei';
import type { PhoneStatus } from '../../types';

const STATUS_TIMELINE: { status: PhoneStatus; label: string; icon: React.ReactNode }[] = [
  { status: 'En Bodega (USA)', label: 'Bodega USA', icon: <Package className="w-4 h-4" /> },
  { status: 'En Tránsito (a El Salvador)', label: 'En Tránsito', icon: <Truck className="w-4 h-4" /> },
  { status: 'En Stock (Disponible para Venta)', label: 'En Stock', icon: <CheckCircle2 className="w-4 h-4" /> },
  { status: 'Vendido', label: 'Vendido', icon: <CheckCircle2 className="w-4 h-4" /> },
];

function getTimelineStep(estado: PhoneStatus): number {
  if (['En Bodega (USA)'].includes(estado)) return 0;
  if (['En Tránsito (a El Salvador)'].includes(estado)) return 1;
  if (['En Stock (Disponible para Venta)', 'Apartado'].includes(estado)) return 2;
  if (['Vendido', 'Pagado', 'Entregado al Cliente', 'Vendido (Pendiente de Entrega)'].includes(estado)) return 3;
  if (estado.includes('Taller')) return 2; // workshop states are parallel to stock
  return 0;
}

export default function PhonePortalPage() {
  const { imei } = useParams<{ imei: string }>();
  const { data: phone, isLoading } = usePhoneByImei(imei || '');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Buscando teléfono...</div>
      </div>
    );
  }

  if (!phone) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <AlertTriangle className="w-12 h-12 text-amber-400" />
        <h1 className="text-xl font-bold text-gray-800">Teléfono no encontrado</h1>
        <p className="text-gray-500">IMEI: {imei}</p>
        <Link to="/inventory" className="text-primary-600 hover:underline">
          Volver al inventario
        </Link>
      </div>
    );
  }

  const currentStep = getTimelineStep(phone.estado);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link to="/inventory" className="text-gray-400 hover:text-gray-600" aria-label="Volver">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Smartphone className="w-5 h-5 text-primary-600" />
          <h1 className="text-lg font-bold text-gray-900">Detalle de Teléfono</h1>
          <button
            onClick={() => window.open(`/labels/single/${phone.imei}`, '_blank')}
            className="ml-auto text-gray-400 hover:text-gray-600"
            aria-label="Imprimir sticker"
          >
            <Printer className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Seized banner */}
        {phone.seized && (
          <div className="bg-red-100 border-2 border-red-300 rounded-2xl px-5 py-4 flex items-center gap-3">
            <ShieldOff className="w-6 h-6 text-red-600" />
            <div>
              <p className="font-bold text-red-800">INHABILITADO</p>
              <p className="text-sm text-red-600">
                {phone.seizedReason} — {phone.seizedDate}
              </p>
            </div>
          </div>
        )}

        {/* Main info card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {phone.marca} {phone.modelo}
              </h2>
              <p className="text-gray-500">{phone.storage}</p>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
              phone.estado.includes('Stock') ? 'bg-emerald-100 text-emerald-700' :
              phone.estado.includes('Vendido') || phone.estado.includes('Pagado') ? 'bg-blue-100 text-blue-700' :
              phone.estado.includes('Taller') ? 'bg-orange-100 text-orange-700' :
              phone.estado.includes('Tránsito') ? 'bg-indigo-100 text-indigo-700' :
              'bg-gray-100 text-gray-600'
            }`}>
              {phone.estado}
            </span>
          </div>

          {/* IMEI */}
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">IMEI</p>
            <p className="text-2xl font-mono font-bold text-gray-900 tracking-widest">{phone.imei}</p>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Lote</p>
              <p className="font-semibold text-gray-800">{phone.lote}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Condición</p>
              <p className="font-semibold text-gray-800">{phone.condition || 'N/A'}</p>
            </div>
            {phone.supplierCode && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">Proveedor</p>
                <p className="font-semibold text-gray-800">{phone.supplierCode}</p>
              </div>
            )}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">Fecha ingreso</p>
              <p className="font-semibold text-gray-800">
                {phone.fechaIngreso
                  ? new Date(typeof phone.fechaIngreso === 'string' ? phone.fechaIngreso : (phone.fechaIngreso as any)?.toDate?.() || phone.fechaIngreso).toLocaleDateString()
                  : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">Progreso</h3>
          <div className="flex items-center justify-between">
            {STATUS_TIMELINE.map((step, i) => (
              <div key={step.status} className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
                  i <= currentStep ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {step.icon}
                </div>
                <p className={`text-[10px] text-center font-medium ${
                  i <= currentStep ? 'text-primary-600' : 'text-gray-400'
                }`}>
                  {step.label}
                </p>
              </div>
            ))}
          </div>
          {/* Progress bar behind dots */}
          <div className="h-1 bg-gray-200 rounded-full mt-2 -mb-1">
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-300"
              style={{ width: `${(currentStep / (STATUS_TIMELINE.length - 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Status history */}
        {phone.statusHistory && phone.statusHistory.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
              Historial ({phone.statusHistory.length})
            </h3>
            <div className="space-y-3">
              {[...phone.statusHistory]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .map((change, i) => (
                  <div key={i} className="flex items-start gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary-400 mt-1.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-gray-800">{change.newStatus}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(change.date).toLocaleString()} — {change.user}
                      </p>
                      {change.details && (
                        <p className="text-xs text-gray-500 mt-0.5">{change.details}</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/features/phone-portal/
git commit -m "feat: add PhonePortalPage — internal phone detail view by IMEI"
```

---

### Task 2.3: Add route and navigation

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add lazy import and route**

In `src/App.tsx`, add the lazy import:

```typescript
const PhonePortalPage = lazy(() => import('./features/phone-portal/PhonePortalPage'));
```

Add the route inside the admin/gerente section:

```tsx
<Route path="/phone/:imei" element={
  <ProtectedRoute allowedRoles={['admin', 'gerente']}>
    <PhonePortalPage />
  </ProtectedRoute>
} />
```

- [ ] **Step 2: Verify in browser**

Run: `npm run dev`
Navigate to `/phone/356371101234567` (use a real IMEI from the DB)
Expected: Phone detail page loads with all info

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add /phone/:imei route (admin, gerente)"
```

---

### Task 2.4: Link from inventory to portal

**Files:**
- Modify: `src/features/inventory/components/PhoneDetailsModal.tsx`

- [ ] **Step 1: Add portal link button**

In PhoneDetailsModal, near the IMEI display, add a clickable link:

```tsx
<Link
  to={`/phone/${phone.imei}`}
  className="text-primary-600 hover:underline text-xs font-medium"
  target="_blank"
>
  Ver en portal →
</Link>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/inventory/components/PhoneDetailsModal.tsx
git commit -m "feat: link from phone detail modal to portal page"
```

---

## Chunk 3: Sticker System — Barcode + QR Labels

**Engineer:** Frontend Components
**Estimated tasks:** 5
**Dependencies:** Chunk 2 (QR links to portal page)

### Task 3.1: Install JsBarcode

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install dependency**

Run: `npm install jsbarcode`

- [ ] **Step 2: Install TypeScript types**

Run: `npm install -D @types/jsbarcode`

If types don't exist, create a declaration file `src/types/jsbarcode.d.ts`:

```typescript
declare module 'jsbarcode' {
  function JsBarcode(element: SVGElement | string, data: string, options?: Record<string, unknown>): void;
  export default JsBarcode;
}
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json src/types/jsbarcode.d.ts
git commit -m "chore: add jsbarcode for sticker barcode generation"
```

---

### Task 3.2: Create sticker utility functions

**Files:**
- Create: `src/features/labels/utils/stickerUtils.ts`
- Create: `src/features/labels/__tests__/stickerUtils.test.ts`

- [ ] **Step 1: Write tests**

Create `src/features/labels/__tests__/stickerUtils.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildTrackingUrl, formatStickerInfo, formatImeiDisplay } from '../utils/stickerUtils';

describe('stickerUtils', () => {
  describe('buildTrackingUrl', () => {
    it('generates portal URL with IMEI', () => {
      const url = buildTrackingUrl('356371101234567');
      expect(url).toContain('/phone/356371101234567');
    });

    it('uses current origin as base', () => {
      const url = buildTrackingUrl('356371101234567');
      expect(url).toMatch(/^https?:\/\//);
    });
  });

  describe('formatStickerInfo', () => {
    it('formats full phone info', () => {
      const info = formatStickerInfo('Apple', 'iPhone 15 Pro Max', '256GB');
      expect(info).toBe('iPhone 15 Pro Max · 256GB');
    });

    it('omits storage if missing', () => {
      const info = formatStickerInfo('Samsung', 'Galaxy S24', undefined);
      expect(info).toBe('Galaxy S24');
    });
  });

  describe('formatImeiDisplay', () => {
    it('groups IMEI digits for readability', () => {
      const display = formatImeiDisplay('356371101234567');
      expect(display).toBe('35 637110 123456 7');
    });

    it('returns raw IMEI if not 15 digits', () => {
      const display = formatImeiDisplay('12345678');
      expect(display).toBe('12345678');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/labels/__tests__/stickerUtils.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement utilities**

Create `src/features/labels/utils/stickerUtils.ts`:

```typescript
const PRODUCTION_ORIGIN = 'https://inventario-a6aa3.web.app';

/** Build the tracking URL that QR code will encode */
export function buildTrackingUrl(imei: string): string {
  const origin = typeof window !== 'undefined'
    ? window.location.origin
    : PRODUCTION_ORIGIN;
  return `${origin}/phone/${imei}`;
}

/** Format model + storage for sticker display (no brand — brand has its own line) */
export function formatStickerInfo(
  _marca: string,
  modelo: string,
  storage?: string
): string {
  return [modelo, storage].filter(Boolean).join(' · ');
}

/** Format IMEI with TAC grouping: AA BBBBBB CCCCCC D */
export function formatImeiDisplay(imei: string): string {
  if (imei.length !== 15) return imei;
  return `${imei.slice(0, 2)} ${imei.slice(2, 8)} ${imei.slice(8, 14)} ${imei.slice(14)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/labels/__tests__/stickerUtils.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/labels/
git commit -m "feat: add sticker utility functions with tests"
```

---

### Task 3.3: Create PhoneStickerLabel component

**Files:**
- Create: `src/features/labels/components/PhoneStickerLabel.tsx`

- [ ] **Step 1: Create the single sticker component**

Create `src/features/labels/components/PhoneStickerLabel.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import JsBarcode from 'jsbarcode';
import { buildTrackingUrl, formatStickerInfo, formatImeiDisplay } from '../utils/stickerUtils';
import type { Phone } from '../../../types';

interface Props {
  phone: Phone;
  shipmentName?: string;
  supplierName?: string;
  index?: number;
  total?: number;
}

export default function PhoneStickerLabel({ phone, shipmentName, supplierName, index, total }: Props) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const trackingUrl = buildTrackingUrl(phone.imei);

  useEffect(() => {
    if (barcodeRef.current && !phone.seized) {
      try {
        JsBarcode(barcodeRef.current, phone.imei, {
          format: 'CODE128',
          width: 1.2,
          height: 25,
          displayValue: false,
          margin: 0,
        });
      } catch {
        // Invalid barcode data — fallback to text-only
      }
    }
  }, [phone.imei, phone.seized]);

  return (
    <div className="w-[50mm] min-h-[30mm] border border-dashed border-gray-300 print:border-none bg-white p-1.5 font-mono text-black flex flex-col page-break-after-always">
      {/* Row 1: Header + QR side by side */}
      <div className="flex items-start gap-1.5 mb-1">
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-black uppercase tracking-wider leading-none">TOP LINE TEC</p>
          <p className="text-[11px] font-bold leading-tight mt-0.5 truncate">{phone.marca} {phone.modelo}</p>
          <p className="text-[9px] leading-tight">{phone.storage || ''}</p>
          {shipmentName && (
            <p className="text-[7px] text-gray-600 mt-0.5 truncate">{shipmentName}{supplierName ? ` · ${supplierName}` : ''}</p>
          )}
        </div>
        {!phone.seized && (
          <QRCodeSVG value={trackingUrl} size={42} className="shrink-0" />
        )}
      </div>

      {/* Row 2: Barcode or INHABILITADO */}
      <div className="flex flex-col items-center">
        {phone.seized ? (
          <div className="bg-red-600 text-white font-black text-[9px] px-2 py-1 rounded">
            INHABILITADO
          </div>
        ) : (
          <>
            <svg ref={barcodeRef} className="w-full" />
            <p className="text-[7px] tracking-[0.15em] font-bold leading-none">
              {formatImeiDisplay(phone.imei)}
            </p>
          </>
        )}
      </div>

      {/* Counter */}
      {index !== undefined && total !== undefined && (
        <p className="text-[6px] text-center text-gray-400 mt-0.5">
          {index + 1}/{total}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/features/labels/components/PhoneStickerLabel.tsx
git commit -m "feat: add PhoneStickerLabel component with barcode + QR"
```

---

### Task 3.4: Create StickerPrintView (batch print page)

**Files:**
- Create: `src/features/labels/components/StickerPrintView.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create batch print view**

Create `src/features/labels/components/StickerPrintView.tsx`:

```tsx
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import PhoneStickerLabel from './PhoneStickerLabel';
import { Printer } from 'lucide-react';
import type { Phone } from '../../../types';

export default function StickerPrintView() {
  const { lote, imei } = useParams<{ lote?: string; imei?: string }>();

  const { data: phones = [], isLoading } = useQuery({
    queryKey: ['sticker-phones', lote, imei],
    queryFn: async () => {
      if (imei) {
        // Single phone sticker
        const q = query(collection(db, 'phones'), where('imei', '==', imei));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Phone));
      }
      if (lote) {
        // All phones in lote
        const q = query(collection(db, 'phones'), where('lote', '==', lote));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as Phone));
      }
      return [];
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Cargando teléfonos...</div>;
  }

  return (
    <div>
      {/* Print controls — hidden when printing */}
      <div className="print:hidden bg-gray-100 p-4 text-center space-y-2 sticky top-0 z-10">
        <p className="text-lg font-bold">
          {phones.length} sticker{phones.length !== 1 ? 's' : ''} — {lote || imei}
        </p>
        <button
          onClick={() => window.print()}
          className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-xl font-semibold inline-flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          Imprimir
        </button>
      </div>

      {/* Stickers grid */}
      <div className="flex flex-wrap gap-4 p-4 justify-center print:gap-0 print:p-0">
        {phones.map((phone, i) => (
          <PhoneStickerLabel
            key={phone.id}
            phone={phone}
            shipmentName={phone.lote}
            index={i}
            total={phones.length}
          />
        ))}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { margin: 5mm; size: auto; }
          body { margin: 0; }
          .print\\:hidden { display: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:gap-0 { gap: 0 !important; }
          .print\\:p-0 { padding: 0 !important; }
          .page-break-after-always { page-break-after: always; }
          .page-break-after-always:last-child { page-break-after: auto; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Add routes in App.tsx**

Add lazy import:

```typescript
const StickerPrintView = lazy(() => import('./features/labels/components/StickerPrintView'));
```

Add routes (admin/gerente):

```tsx
<Route path="/labels/lote/:lote" element={
  <ProtectedRoute allowedRoles={['admin', 'gerente']}>
    <StickerPrintView />
  </ProtectedRoute>
} />
<Route path="/labels/single/:imei" element={
  <ProtectedRoute allowedRoles={['admin', 'gerente']}>
    <StickerPrintView />
  </ProtectedRoute>
} />
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`
Navigate to `/labels/lote/SOME-LOTE-NAME`
Expected: Grid of stickers with print button

- [ ] **Step 4: Commit**

```bash
git add src/features/labels/components/StickerPrintView.tsx src/App.tsx
git commit -m "feat: add StickerPrintView with batch and single print modes"
```

---

### Task 3.5: Add "Imprimir Stickers" button to receiving flow

**Files:**
- Modify: `src/features/receiving/ReceivingPage.tsx`

- [ ] **Step 1: Add print stickers button after successful close**

In `ReceivingPage.tsx`, find the `ActaReceptionModal` `onDone` callback. Add a print stickers link in the Acta modal or after it. The simplest approach: after the acta modal, add a button that opens the sticker print view:

In the acta data handler section, modify the `onDone` callback:

```tsx
{actaData && (
  <ActaReceptionModal
    lote={actaData.lote}
    reportId={actaData.reportId}
    receivedPhones={actaData.receivedPhones}
    missingImeis={actaData.missingImeis}
    onDone={() => {
      // Open sticker print in new tab before navigating
      window.open(`/labels/lote/${encodeURIComponent(actaData.lote)}`, '_blank');
      setActaData(null);
      navigate('/inventory');
    }}
  />
)}
```

Also add a standalone print button visible when okCount > 0 and there are results:

```tsx
{okCount > 0 && (
  <a
    href={`/labels/lote/${encodeURIComponent(selectedLote)}`}
    target="_blank"
    rel="noreferrer"
    className="w-full border-2 border-primary-200 text-primary-700 font-bold py-3 rounded-2xl text-center block hover:bg-primary-50 transition-colors flex items-center justify-center gap-2"
  >
    <Printer className="w-5 h-5" />
    Imprimir stickers del lote
  </a>
)}
```

Add `Printer` to the lucide-react imports.

- [ ] **Step 2: Verify in browser**

Run: `npm run dev`
Go to receiving, complete a session → verify sticker print link appears.

- [ ] **Step 3: Commit**

```bash
git add src/features/receiving/ReceivingPage.tsx
git commit -m "feat: add print stickers button to receiving flow"
```

---

## Chunk 4: Cotizador — Pre-Purchase Builder

**Engineer:** UX & Flows
**Estimated tasks:** 5
**Dependencies:** None (uses existing phone data)

### Task 4.1: Create Zustand cotizador store

**Files:**
- Create: `src/features/cotizador/hooks/useCotizador.ts`
- Create: `src/features/cotizador/__tests__/useCotizador.test.ts`

- [ ] **Step 1: Write tests for cart logic**

Create `src/features/cotizador/__tests__/useCotizador.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

// Pure cart logic (mirrors the Zustand store)
interface CartItem {
  phoneId: string;
  imei: string;
  marca: string;
  modelo: string;
  storage?: string;
  precio: number;
  addedAt: number;
}

interface RemovedItem extends CartItem {
  removedAt: number;
  removedBy: string;
}

function createCart() {
  let items: CartItem[] = [];
  let removed: RemovedItem[] = [];

  return {
    getItems: () => items,
    getRemoved: () => removed,
    getTotal: () => items.reduce((sum, i) => sum + i.precio, 0),
    getCount: () => items.length,

    addItem: (item: CartItem) => {
      if (items.some(i => i.imei === item.imei)) return false; // duplicate
      items = [item, ...items];
      return true;
    },

    removeItem: (imei: string, removedBy: string) => {
      const item = items.find(i => i.imei === imei);
      if (!item) return false;
      items = items.filter(i => i.imei !== imei);
      removed = [{ ...item, removedAt: Date.now(), removedBy }, ...removed];
      return true;
    },

    clear: () => {
      items = [];
      removed = [];
    },
  };
}

describe('Cotizador cart logic', () => {
  let cart: ReturnType<typeof createCart>;

  beforeEach(() => {
    cart = createCart();
  });

  it('adds phone to cart', () => {
    const added = cart.addItem({
      phoneId: 'p1', imei: '356371101234567',
      marca: 'Apple', modelo: 'iPhone 15 Pro Max', storage: '256GB',
      precio: 850, addedAt: Date.now(),
    });
    expect(added).toBe(true);
    expect(cart.getCount()).toBe(1);
    expect(cart.getTotal()).toBe(850);
  });

  it('rejects duplicate IMEI', () => {
    const item = {
      phoneId: 'p1', imei: '356371101234567',
      marca: 'Apple', modelo: 'iPhone 15', storage: '128GB',
      precio: 500, addedAt: Date.now(),
    };
    cart.addItem(item);
    const added = cart.addItem(item);
    expect(added).toBe(false);
    expect(cart.getCount()).toBe(1);
  });

  it('removes phone and tracks in audit log', () => {
    cart.addItem({
      phoneId: 'p1', imei: '356371101234567',
      marca: 'Apple', modelo: 'iPhone 15', storage: '128GB',
      precio: 500, addedAt: Date.now(),
    });
    const removed = cart.removeItem('356371101234567', 'admin@topline.com');
    expect(removed).toBe(true);
    expect(cart.getCount()).toBe(0);
    expect(cart.getRemoved()).toHaveLength(1);
    expect(cart.getRemoved()[0].removedBy).toBe('admin@topline.com');
  });

  it('calculates total correctly with multiple items', () => {
    cart.addItem({ phoneId: 'p1', imei: '111', marca: 'Apple', modelo: 'A', precio: 500, addedAt: 1 });
    cart.addItem({ phoneId: 'p2', imei: '222', marca: 'Samsung', modelo: 'B', precio: 300, addedAt: 2 });
    cart.addItem({ phoneId: 'p3', imei: '333', marca: 'Apple', modelo: 'C', precio: 750, addedAt: 3 });
    expect(cart.getTotal()).toBe(1550);
    expect(cart.getCount()).toBe(3);
  });

  it('clear resets everything', () => {
    cart.addItem({ phoneId: 'p1', imei: '111', marca: 'Apple', modelo: 'A', precio: 500, addedAt: 1 });
    cart.removeItem('111', 'user');
    cart.clear();
    expect(cart.getCount()).toBe(0);
    expect(cart.getRemoved()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run src/features/cotizador/__tests__/useCotizador.test.ts`
Expected: PASS (pure logic, no imports to fail)

- [ ] **Step 3: Implement the Zustand store**

Create `src/features/cotizador/hooks/useCotizador.ts`:

```typescript
import { create } from 'zustand';

export interface CartItem {
  phoneId: string;
  imei: string;
  marca: string;
  modelo: string;
  storage?: string;
  precio: number;
  addedAt: number;
}

export interface RemovedItem extends CartItem {
  removedAt: number;
  removedBy: string;
}

interface CotizadorState {
  items: CartItem[];
  removed: RemovedItem[];

  addItem: (item: CartItem) => boolean;
  removeItem: (imei: string, removedBy: string) => boolean;
  clear: () => void;
  getTotal: () => number;
}

export const useCotizador = create<CotizadorState>((set, get) => ({
  items: [],
  removed: [],

  addItem: (item) => {
    const { items } = get();
    if (items.some(i => i.imei === item.imei)) return false;
    set({ items: [item, ...items] });
    return true;
  },

  removeItem: (imei, removedBy) => {
    const { items, removed } = get();
    const item = items.find(i => i.imei === imei);
    if (!item) return false;
    set({
      items: items.filter(i => i.imei !== imei),
      removed: [{ ...item, removedAt: Date.now(), removedBy }, ...removed],
    });
    return true;
  },

  clear: () => set({ items: [], removed: [] }),

  getTotal: () => get().items.reduce((sum, i) => sum + i.precio, 0),
}));
```

- [ ] **Step 4: Commit**

```bash
git add src/features/cotizador/
git commit -m "feat: add cotizador Zustand store with audit trail"
```

---

### Task 4.2: Create CotizadorSearch component

**Files:**
- Create: `src/features/cotizador/components/CotizadorSearch.tsx`

- [ ] **Step 1: Create search/scanner input**

Create `src/features/cotizador/components/CotizadorSearch.tsx`:

```tsx
import { useState, useRef, useCallback } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { ScanBarcode, Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCotizador, type CartItem } from '../hooks/useCotizador';
import type { Phone } from '../../../types';

export default function CotizadorSearch() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addItem = useCotizador(s => s.addItem);

  const refocus = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleSearch = async () => {
    let imei = input.trim().replace(/\D/g, '');
    if (!imei || imei.length < 8) {
      toast.error('IMEI inválido');
      return;
    }

    // GS1 normalization
    if (imei.length === 16 && imei[0] === '1') {
      imei = imei.substring(1);
    }

    setLoading(true);
    try {
      const q = query(
        collection(db, 'phones'),
        where('imei', '==', imei),
        limit(1)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        toast.error(`IMEI ${imei} no encontrado`);
        return;
      }

      const phone = { id: snap.docs[0].id, ...snap.docs[0].data() } as Phone;

      if (phone.seized) {
        toast.error(`${phone.marca} ${phone.modelo} está INHABILITADO`);
        return;
      }

      if (phone.estado !== 'En Stock (Disponible para Venta)') {
        toast.error(`${phone.marca} ${phone.modelo} no está disponible (${phone.estado})`);
        return;
      }

      const item: CartItem = {
        phoneId: phone.id,
        imei: phone.imei,
        marca: phone.marca,
        modelo: phone.modelo,
        storage: phone.storage,
        precio: phone.precioVenta,
        addedAt: Date.now(),
      };

      const added = addItem(item);
      if (!added) {
        toast.error('Ya está en la cotización');
      } else {
        toast.success(`${phone.marca} ${phone.modelo} agregado`);
      }
    } catch {
      toast.error('Error buscando teléfono');
    } finally {
      setLoading(false);
      setInput('');
      refocus();
    }
  };

  return (
    <div className="bg-slate-900 rounded-2xl p-5 shadow-lg" onClick={refocus}>
      <div className="flex items-center gap-3 mb-3">
        <ScanBarcode className="w-6 h-6 text-emerald-400 animate-pulse" />
        <p className="text-white font-semibold">Agregar teléfono</p>
      </div>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearch();
            }
          }}
          className="flex-1 bg-slate-800 border border-slate-700 text-white text-xl font-mono px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-600 tracking-widest"
          placeholder="Escanear o escribir IMEI"
          autoComplete="off"
          inputMode="numeric"
          aria-label="Buscar IMEI para cotización"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 rounded-xl disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/cotizador/components/CotizadorSearch.tsx
git commit -m "feat: add CotizadorSearch — IMEI scanner input for pre-purchase"
```

---

### Task 4.3: Create CotizadorCart component

**Files:**
- Create: `src/features/cotizador/components/CotizadorCart.tsx`

- [ ] **Step 1: Create cart UI**

Create `src/features/cotizador/components/CotizadorCart.tsx`:

```tsx
import { X, Smartphone } from 'lucide-react';
import { useCotizador } from '../hooks/useCotizador';
import { useAuth } from '../../../context';

export default function CotizadorCart() {
  const items = useCotizador(s => s.items);
  const removeItem = useCotizador(s => s.removeItem);
  const getTotal = useCotizador(s => s.getTotal);
  const { user } = useAuth();

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
        <Smartphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-400 font-medium">Escanea un IMEI para empezar</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-700">
          Teléfonos ({items.length})
        </p>
      </div>

      <div className="divide-y divide-gray-50 max-h-[50vh] overflow-y-auto">
        {items.map(item => (
          <div key={item.imei} className="flex items-center gap-3 px-5 py-4">
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-gray-900">
                {item.marca} {item.modelo}
                {item.storage && <span className="text-gray-400 font-normal"> · {item.storage}</span>}
              </p>
              <p className="text-lg font-mono text-gray-600 tracking-wider">{item.imei}</p>
            </div>
            <p className="text-xl font-bold text-gray-900 shrink-0">
              ${item.precio.toLocaleString()}
            </p>
            <button
              onClick={() => removeItem(item.imei, user?.email || 'unknown')}
              className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-700 transition-colors"
              aria-label={`Quitar ${item.marca} ${item.modelo}`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

      {/* Total — always visible, sticky at bottom */}
      <div className="border-t-2 border-gray-200 bg-gray-50 px-5 py-4 flex items-center justify-between">
        <p className="text-gray-600 font-semibold">Total</p>
        <p className="text-3xl font-black text-gray-900">
          ${getTotal().toLocaleString()}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/cotizador/components/CotizadorCart.tsx
git commit -m "feat: add CotizadorCart with live totals and big remove buttons"
```

---

### Task 4.4: Create CotizadorAuditLog and main CotizadorPage

**Files:**
- Create: `src/features/cotizador/components/CotizadorAuditLog.tsx`
- Create: `src/features/cotizador/CotizadorPage.tsx`

- [ ] **Step 1: Create audit log component**

Create `src/features/cotizador/components/CotizadorAuditLog.tsx`:

```tsx
import { useCotizador } from '../hooks/useCotizador';
import { Trash2 } from 'lucide-react';

export default function CotizadorAuditLog() {
  const removed = useCotizador(s => s.removed);

  if (removed.length === 0) return null;

  return (
    <div className="bg-amber-50 rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-amber-100 flex items-center gap-2">
        <Trash2 className="w-4 h-4 text-amber-600" />
        <p className="text-sm font-semibold text-amber-700">
          Eliminados ({removed.length})
        </p>
      </div>
      <div className="divide-y divide-amber-50 max-h-40 overflow-y-auto">
        {removed.map((item, i) => (
          <div key={`${item.imei}-${i}`} className="px-5 py-2 text-sm">
            <p className="text-amber-800">
              <span className="font-semibold">{item.marca} {item.modelo}</span>
              {' · '}${item.precio.toLocaleString()}
            </p>
            <p className="text-xs text-amber-500">
              Quitado por {item.removedBy} a las{' '}
              {new Date(item.removedAt).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create main page**

Create `src/features/cotizador/CotizadorPage.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Trash2 } from 'lucide-react';
import CotizadorSearch from './components/CotizadorSearch';
import CotizadorCart from './components/CotizadorCart';
import CotizadorAuditLog from './components/CotizadorAuditLog';
import { useCotizador } from './hooks/useCotizador';

export default function CotizadorPage() {
  const clear = useCotizador(s => s.clear);
  const count = useCotizador(s => s.items.length);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link to="/dashboard" className="text-gray-400 hover:text-gray-600" aria-label="Volver">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <ShoppingBag className="w-5 h-5 text-primary-600" />
          <h1 className="text-lg font-bold text-gray-900">Cotizador</h1>
          {count > 0 && (
            <button
              onClick={() => {
                if (confirm('Limpiar toda la cotización?')) clear();
              }}
              className="ml-auto text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Limpiar
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 space-y-5">
        <CotizadorSearch />
        <CotizadorCart />
        <CotizadorAuditLog />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/features/cotizador/
git commit -m "feat: add CotizadorPage with search, cart, and audit log"
```

---

### Task 4.5: Add route and navigation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/layout/BottomNav.tsx`

- [ ] **Step 1: Add lazy import and route**

In `src/App.tsx`:

```typescript
const CotizadorPage = lazy(() => import('./features/cotizador/CotizadorPage'));
```

Route:

```tsx
<Route path="/cotizador" element={
  <ProtectedRoute allowedRoles={['admin', 'gerente']}>
    <CotizadorPage />
  </ProtectedRoute>
} />
```

- [ ] **Step 2: Add to BottomNav MORE_ITEMS**

In `src/components/layout/BottomNav.tsx`, add to MORE_ITEMS array:

```typescript
{
  to: '/cotizador',
  icon: <ShoppingBag className="w-5 h-5 text-cyan-600" />,
  label: 'Cotizador',
  roles: ['admin', 'gerente'],
},
```

Add `ShoppingBag` to lucide-react imports.

- [ ] **Step 3: Run all tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/layout/BottomNav.tsx
git commit -m "feat: add /cotizador route and nav entry"
```

---

## Chunk 5: toplinetec.net — Marketing Website

**Engineer:** Marketing & Web
**Estimated tasks:** 3
**Dependencies:** None (separate project)

> **Note:** This chunk creates a separate project in a new directory. It does NOT modify the main `topline-tec` Firebase app.

### Task 5.1: Scaffold Astro site

- [ ] **Step 1: Create project**

```bash
cd /Users/danielabrego/Projects
npm create astro@latest topline-net -- --template minimal --no-install --no-git
cd topline-net
npm install
npm install @astrojs/tailwind tailwindcss
```

- [ ] **Step 2: Configure Astro with Tailwind**

Edit `astro.config.mjs`:

```javascript
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  integrations: [tailwind()],
  site: 'https://toplinetec.net',
});
```

- [ ] **Step 3: Commit**

```bash
cd /Users/danielabrego/Projects/topline-net
git init
git add .
git commit -m "chore: scaffold Astro + Tailwind for toplinetec.net"
```

---

### Task 5.2: Build landing page

- [ ] **Step 1: Create main layout and index page**

This is a static marketing site. Key sections:
- Hero with Miami skyline + navy/cyan branding
- "What We Sell" — categories only (iPhones, Samsung Galaxy, Laptops) — NO prices, NO models
- About Us (corrected copy — "Top Line Tec Inc", not "Tec Line Solutions")
- Contact → WhatsApp link
- Footer with address, phone, social links

Download the logo from toplinetecinc.com to `public/logo.png`.

The page should be responsive mobile-first, use Inter or system font stack, and have the navy (#0a1628) + cyan (#00d4ff) color scheme.

- [ ] **Step 2: Add noindex to old .com site**

In the Wix admin for toplinetecinc.com, add:
```html
<meta name="robots" content="noindex, nofollow">
```

Or if no Wix access, add via DNS a `X-Robots-Tag: noindex` header (requires server config).

**NOTE:** This is a manual step Eduardo must do in Wix settings. Document it but don't automate.

- [ ] **Step 3: Commit**

```bash
git add .
git commit -m "feat: toplinetec.net landing page — Miami aesthetic, no prices"
```

---

### Task 5.3: Deploy to Netlify/Vercel

- [ ] **Step 1: Deploy**

```bash
npm run build
# Deploy via Netlify CLI or Vercel CLI
npx netlify deploy --prod --dir=dist
```

Or connect GitHub repo to Netlify for auto-deploy.

- [ ] **Step 2: Configure custom domain**

Point `toplinetec.net` DNS to Netlify:
- A record → Netlify IP
- CNAME `www` → Netlify subdomain

- [ ] **Step 3: Verify SEO**

Check Google Search Console after 1-2 weeks to confirm .net is indexed and .com is deindexed.

---

## Execution Order Summary

```
Chunk 1: CECOT (Tasks 1.1–1.4) ─── foundation, do first
    ↓
Chunk 2: Portal (Tasks 2.1–2.4) ── depends on seized field
    ↓
Chunk 3: Stickers (Tasks 3.1–3.5) ─ depends on portal URL

Chunk 4: Cotizador (Tasks 4.1–4.5) ─ independent, can parallel with 2-3

Chunk 5: toplinetec.net (Tasks 5.1–5.3) ─ fully independent, separate repo
```

**Parallelizable:** Chunks 4 and 5 can run in parallel with everything else.
**Sequential:** 1 → 2 → 3 must be in order.

---

## Testing Strategy

| Area | Type | Files |
|------|------|-------|
| Sticker utils | Unit (pure) | `src/features/labels/__tests__/stickerUtils.test.ts` |
| IMEI normalization | Unit (pure) | `src/features/phone-portal/__tests__/usePhoneByImei.test.ts` |
| Cotizador cart | Unit (pure) | `src/features/cotizador/__tests__/useCotizador.test.ts` |
| Dashboard seized | Unit (pure) | `src/features/dashboard/__tests__/useDashboardStats.test.ts` |
| Existing tests | Regression | All 7 existing test files (129 tests) |

Run all: `npx vitest run` — expect 140+ tests, 0 failures.
