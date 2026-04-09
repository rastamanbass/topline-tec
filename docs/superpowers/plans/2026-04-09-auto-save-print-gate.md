# Auto-Save + Print Gate (cada 10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada telefono escaneado se guarda inmediatamente a Firestore. Cada 10 telefonos, el scanner se bloquea y muestra un overlay de impresion in-page. Eduardo imprime los 10 stickers y el scanner se desbloquea automaticamente.

**Architecture:** Modificar ScannerView para que `processImei` llame `createPhone.mutateAsync()` inmediatamente tras resolver marca/modelo. Agregar un `PrintGateOverlay` que renderiza 10 `PhoneStickerLabel` inline con CSS `@media print`. Eliminar boton "Procesar N Dispositivos". Verificar spacing QR/barcode en PhoneStickerLabel.

**Tech Stack:** React 19, TypeScript, Firebase Firestore, @tanstack/react-query, JsBarcode, qrcode.react

**Rollback:** `git checkout main` restaura todo. Branch `feat/auto-save-print-gate` aislada.

---

### Task 1: Backup y branch de seguridad

**Files:**
- N/A (git operations only)

- [ ] **Step 1: Tag el estado actual como backup**

```bash
cd /Users/danielabrego/Projects/topline-tec
git tag backup/pre-print-gate
```

- [ ] **Step 2: Verificar branch**

```bash
git branch --show-current
```
Expected: `feat/auto-save-print-gate`

---

### Task 2: Auto-save inmediato en ScannerView

**Files:**
- Modify: `src/features/inventory/components/ScannerView.tsx`

- [ ] **Step 1: Agregar estado para tracking de phones guardados**

Agregar estos estados nuevos despues de la linea 57 (`batchPrice`):

```typescript
// Print gate: track saved phones for current print cycle
const [savedInCycle, setSavedInCycle] = useState<Array<{ imei: string; firestoreId: string }>>([]);
const [showPrintGate, setShowPrintGate] = useState(false);
const PRINT_GATE_SIZE = 10;
```

- [ ] **Step 2: Modificar processImei para auto-save**

Reemplazar la logica actual de `processImei` (lineas 63-168). Despues de resolver marca/modelo exitosamente (status `success` o `unknown` con datos editados), guardar inmediatamente a Firestore.

Agregar esta funcion nueva despues de `processImei`:

```typescript
const savePhoneToFirestore = async (item: ScannedItem) => {
  if (!item.brand || !item.model) return null;

  const { marca: finalMarca, supplierCode } = splitMarcaAndSupplier(item.brand, item.model);
  const firestoreId = await createPhone.mutateAsync({
    imei: item.imei,
    marca: finalMarca,
    supplierCode: supplierCode,
    modelo: item.model,
    storage: item.storage,
    costo: batchCost ? parseFloat(batchCost) : item.cost,
    precioVenta: batchPrice ? parseFloat(batchPrice) : item.price,
    lote: batchLot,
    estado: userRole === 'admin' ? 'En Bodega (USA)' : 'En Stock (Disponible para Venta)',
    condition: 'Grade A',
  });
  return firestoreId;
};
```

Modificar el bloque `if (def)` dentro de `processImei` (linea 138-154) para que despues de setear status `success`, tambien guarde:

```typescript
if (def) {
  const updatedItem = {
    ...newItem,
    brand: def.brand,
    model: def.model,
    storage: (def as any).storage || newItem.storage,
    theftStatus: 'UNKNOWN',
    status: 'success' as const,
    cost: batchCost ? parseFloat(batchCost) : 0,
    price: batchPrice ? parseFloat(batchPrice) : 0,
  };

  setScannedItems((prev) =>
    prev.map((item) => (item.tempId === tempId ? updatedItem : item))
  );

  // Auto-save to Firestore immediately
  try {
    const firestoreId = await savePhoneToFirestore(updatedItem);
    if (firestoreId) {
      setSavedInCycle((prev) => {
        const next = [...prev, { imei: updatedItem.imei, firestoreId }];
        if (next.length >= PRINT_GATE_SIZE) {
          setShowPrintGate(true);
        }
        return next;
      });
      // Mark as saved in UI
      setScannedItems((prev) =>
        prev.map((item) =>
          item.tempId === tempId ? { ...item, status: 'success' as const } : item
        )
      );
      toast.success(`${def.brand} ${def.model} guardado`);
    }
  } catch (err) {
    console.error('Auto-save failed:', err);
    toast.error(`Error guardando ${updatedItem.imei}`);
  }
}
```

- [ ] **Step 3: Deshabilitar input cuando print gate activo**

En el input del scanner (linea 276-289), agregar `disabled`:

```tsx
<input
  ref={inputRef}
  type="text"
  value={inputBuffer}
  onChange={(e) => setInputBuffer(e.target.value)}
  onKeyDown={handleKeyDown}
  disabled={showPrintGate}
  className={`w-full bg-slate-800/50 border border-slate-600 text-white text-3xl p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono transition-all placeholder:text-slate-700 ${showPrintGate ? 'opacity-50 cursor-not-allowed' : ''}`}
  placeholder={showPrintGate ? 'Imprime los stickers para continuar...' : 'Escanea aquí...'}
  autoComplete="off"
  autoFocus
/>
```

- [ ] **Step 4: Eliminar boton "Procesar N Dispositivos"**

Eliminar el bloque completo del bottom floating action bar (lineas 526-544) y la funcion `handleSubmitAll` (lineas 222-257). Ya no se necesitan porque cada telefono se guarda al escanear.

- [ ] **Step 5: Commit**

```bash
git add src/features/inventory/components/ScannerView.tsx
git commit -m "feat(scanner): auto-save phones to Firestore on scan"
```

---

### Task 3: PrintGateOverlay component

**Files:**
- Create: `src/features/inventory/components/PrintGateOverlay.tsx`

- [ ] **Step 1: Crear el componente**

```tsx
import { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../../lib/firebase';
import PhoneStickerLabel from '../../labels/components/PhoneStickerLabel';
import { Printer, CheckCircle } from 'lucide-react';
import type { Phone } from '../../../types';

interface PrintGateOverlayProps {
  imeis: string[];
  onComplete: () => void;
}

export default function PrintGateOverlay({ imeis, onComplete }: PrintGateOverlayProps) {
  const [hasPrinted, setHasPrinted] = useState(false);

  const { data: phones = [], isLoading } = useQuery({
    queryKey: ['print-gate-phones', imeis],
    queryFn: async () => {
      if (imeis.length === 0) return [];
      // Firestore 'in' supports up to 30 values, we only ever pass 10
      const q = query(collection(db, 'phones'), where('imei', 'in', imeis));
      const snap = await getDocs(q);
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Phone);
    },
    enabled: imeis.length > 0,
  });

  const handlePrint = () => {
    window.print();
    setHasPrinted(true);
  };

  const handleContinue = () => {
    onComplete();
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-center">
          <span className="animate-spin text-4xl">⏳</span>
          <p className="mt-4 text-lg font-semibold">Cargando stickers...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Screen overlay - hidden when printing */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center no-print">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8 text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Printer className="w-8 h-8 text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            10 telefonos escaneados
          </h2>
          <p className="text-slate-500 mb-6">
            Imprime los stickers antes de continuar escaneando.
          </p>

          <div className="text-left bg-slate-50 rounded-xl p-4 mb-6 max-h-48 overflow-y-auto">
            {phones.map((phone, i) => (
              <div key={phone.id} className="flex justify-between items-center py-1 border-b border-slate-100 last:border-0">
                <span className="text-sm font-mono text-slate-600">{i + 1}. {phone.imei}</span>
                <span className="text-sm font-semibold text-slate-900">{phone.marca} {phone.modelo}</span>
              </div>
            ))}
          </div>

          {!hasPrinted ? (
            <button
              onClick={handlePrint}
              className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-slate-800 transition-all"
            >
              <Printer className="w-5 h-5" />
              Imprimir {phones.length} Stickers
            </button>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleContinue}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 hover:bg-green-700 transition-all"
              >
                <CheckCircle className="w-5 h-5" />
                Continuar Escaneando
              </button>
              <button
                onClick={handlePrint}
                className="w-full bg-slate-100 text-slate-600 py-3 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-all"
              >
                Reimprimir
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Print-only area: stickers */}
      <div className="print-area hidden print:block">
        {phones.map((phone, i) => (
          <PhoneStickerLabel
            key={phone.id}
            phone={phone}
            index={i}
            total={phones.length}
          />
        ))}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            size: 60mm 40mm;
            margin: 0;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print, nav, header, footer {
            display: none !important;
          }
          .print-area {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .sticker-label {
            width: 100% !important;
            height: 100% !important;
            max-width: none !important;
            aspect-ratio: auto !important;
            margin: 0 !important;
            padding: 2vmin !important;
            border: none !important;
            border-radius: 0 !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-start !important;
            overflow: hidden !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          .sticker-label:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
          .sticker-label > div:first-child {
            display: flex !important;
            flex: none !important;
            align-items: baseline !important;
            gap: 3vmin !important;
            margin-bottom: 0 !important;
          }
          .sticker-label > div:first-child > p {
            font-size: 7vmin !important;
            font-weight: bold !important;
            line-height: 1.1 !important;
            margin: 0 !important;
          }
          .sticker-label > div:first-child > span {
            font-size: 5vmin !important;
          }
          .sticker-label > p:first-of-type {
            font-size: 4vmin !important;
            margin: 1vmin 0 0 !important;
          }
          .sticker-label > div:nth-child(3) {
            margin-top: 2vmin !important;
            flex: none !important;
          }
          .sticker-label > div:nth-child(3) > svg {
            width: 25vmin !important;
            height: 25vmin !important;
          }
          .sticker-label > div:nth-child(4) {
            margin-top: auto !important;
            padding-top: 3vmin !important;
            text-align: center !important;
          }
          .sticker-label > div:nth-child(4) > svg {
            width: 85% !important;
            height: auto !important;
            max-height: 20vmin !important;
          }
          .sticker-label > div:nth-child(4) > p {
            font-size: 4vmin !important;
            font-weight: bold !important;
            letter-spacing: 0.12em !important;
            margin: 1vmin 0 0 !important;
            line-height: 1 !important;
          }
          .sticker-label > p:last-child {
            font-size: 3vmin !important;
            margin: 0 !important;
            line-height: 1 !important;
          }
        }
      `}</style>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/inventory/components/PrintGateOverlay.tsx
git commit -m "feat(scanner): add PrintGateOverlay component for in-page sticker printing"
```

---

### Task 4: Integrar PrintGateOverlay en ScannerView

**Files:**
- Modify: `src/features/inventory/components/ScannerView.tsx`

- [ ] **Step 1: Import PrintGateOverlay**

Agregar al inicio del archivo:

```typescript
import PrintGateOverlay from './PrintGateOverlay';
```

- [ ] **Step 2: Agregar handler para cerrar print gate**

Despues de la funcion `savePhoneToFirestore`:

```typescript
const handlePrintGateComplete = () => {
  setShowPrintGate(false);
  setSavedInCycle([]);
  // Re-focus scanner input
  setTimeout(() => inputRef.current?.focus(), 100);
};
```

- [ ] **Step 3: Renderizar PrintGateOverlay**

Justo antes del cierre del `<div>` principal (antes de `</div>` final, despues de los datalists):

```tsx
{showPrintGate && (
  <PrintGateOverlay
    imeis={savedInCycle.map((s) => s.imei)}
    onComplete={handlePrintGateComplete}
  />
)}
```

- [ ] **Step 4: Agregar contador visual en la toolbar**

Despues del boton "Aplicar" en el batch toolbar (linea 348-353), agregar indicador de progreso:

```tsx
<div className="flex items-center gap-2 bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-200">
  <span className="text-sm font-bold text-slate-700">
    {savedInCycle.length}/{PRINT_GATE_SIZE}
  </span>
  <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
    <div
      className="h-full bg-green-500 rounded-full transition-all duration-300"
      style={{ width: `${(savedInCycle.length / PRINT_GATE_SIZE) * 100}%` }}
    />
  </div>
</div>
```

- [ ] **Step 5: Commit**

```bash
git add src/features/inventory/components/ScannerView.tsx
git commit -m "feat(scanner): integrate print gate overlay with progress indicator"
```

---

### Task 5: Verificar spacing QR/barcode en PhoneStickerLabel

**Files:**
- Modify: `src/features/labels/components/PhoneStickerLabel.tsx`

- [ ] **Step 1: Verificar y ajustar spacing**

El QR (Zone B, linea 52-57) tiene `marginTop: '6px'` y el barcode (Zone C, linea 60) tiene `paddingTop: '6px'` con `marginTop: 'auto'`. El `marginTop: 'auto'` ya empuja el barcode al fondo del sticker, creando separacion natural. Los print styles tambien tienen `padding-top: 3vmin` en Zone C.

Verificar que el spacing sea suficiente. Si el QR y barcode estan muy cerca, aumentar el `paddingTop` de Zone C:

```tsx
{/* Zone C: Barcode (full width, separated from QR) */}
<div style={{ textAlign: 'center', marginTop: 'auto', paddingTop: '10px' }}>
```

Y en los print styles, aumentar el padding:

En `StickerPrintView.tsx` y `PrintGateOverlay.tsx`, el CSS de print ya tiene:
```css
.sticker-label > div:nth-child(4) {
  margin-top: auto !important;
  padding-top: 3vmin !important;
}
```

Cambiar a `padding-top: 5vmin !important;` si necesita mas espacio.

- [ ] **Step 2: Commit**

```bash
git add src/features/labels/components/PhoneStickerLabel.tsx
git commit -m "fix(stickers): increase spacing between QR code and barcode"
```

---

### Task 6: Manejar phones con datos incompletos (unknown/manual edit)

**Files:**
- Modify: `src/features/inventory/components/ScannerView.tsx`

- [ ] **Step 1: Agregar boton manual de guardar para items sin marca/modelo**

Para phones con status `unknown` (TAC no encontrado), Eduardo necesita llenar marca/modelo manualmente. Agregar un boton "Guardar" por item que aparece solo cuando tiene brand+model pero no se ha guardado aun.

En el area de cada item (dentro del map de `scannedItems`), despues del boton de eliminar (linea 511-517), agregar:

```tsx
{item.status === 'unknown' && item.brand && item.model && (
  <button
    onClick={async () => {
      try {
        const firestoreId = await savePhoneToFirestore(item);
        if (firestoreId) {
          setSavedInCycle((prev) => {
            const next = [...prev, { imei: item.imei, firestoreId }];
            if (next.length >= PRINT_GATE_SIZE) {
              setShowPrintGate(true);
            }
            return next;
          });
          setScannedItems((prev) =>
            prev.map((i) => i.tempId === item.tempId ? { ...i, status: 'success' as const } : i)
          );
          toast.success(`${item.brand} ${item.model} guardado`);
        }
      } catch {
        toast.error(`Error guardando ${item.imei}`);
      }
    }}
    className="p-2 text-green-500 hover:text-green-700 hover:bg-green-50 rounded-full transition-colors"
    title="Guardar telefono"
  >
    <Check className="w-4 h-4" />
  </button>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/inventory/components/ScannerView.tsx
git commit -m "feat(scanner): manual save button for phones with unknown TAC"
```

---

### Task 7: Build + test + verificacion final

**Files:**
- N/A (verification only)

- [ ] **Step 1: Build**

```bash
cd /Users/danielabrego/Projects/topline-tec
npx vite build
```
Expected: Build exitoso sin errores

- [ ] **Step 2: Verificar tipos TypeScript**

```bash
npx tsc --noEmit
```
Expected: Sin errores de tipo

- [ ] **Step 3: Run tests**

```bash
npx vitest run
```
Expected: Todos los tests pasan

- [ ] **Step 4: Commit final si hubo fixes**

```bash
git add -A
git commit -m "fix: address build/type issues from print gate feature"
```

---

## Rollback

Si algo sale mal en produccion:

```bash
cd /Users/danielabrego/Projects/topline-tec
git checkout main
npx vite build
firebase deploy --only hosting
```

El tag `backup/pre-print-gate` marca el estado exacto antes de cualquier cambio.
