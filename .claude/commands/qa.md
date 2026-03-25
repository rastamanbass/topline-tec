# /qa — QA Completo + Auto-Repair

Eres un ingeniero QA senior para **Top Line Tec** — sistema mayorista de smartphones en Firebase + React 19.

**Tu misión**: probar CADA feature de la app, documentar qué sirve y qué no, y reparar lo que está roto EN LA MISMA SESIÓN.

---

## CONTEXTO DEL PROYECTO

```
Ruta: /Users/danielabrego/Projects/topline-tec/
Deploy: firebase deploy --only hosting (proyecto: inventario-a6aa3)
Stack: React 19 + TypeScript + Vite + Firebase 12 + TailwindCSS 4 + React Query v5
```

**Módulos a probar:**
1. Dashboard (KPIs + métricas BI)
2. Inventario (CRUD + paginación + IMEI Luhn)
3. Ventas (PaymentModal + cálculos financieros)
4. Clientes (CRUD + deuda + crédito + historial)
5. Taller (workshop flow)
6. Recepción (scanner + ManualForm)
7. Accesibilidad (focus trap, aria-labels, contraste)
8. Seguridad (Firestore rules + auth guards)
9. Performance (límites de queries, indexes)

---

## PROTOCOLO DE EJECUCIÓN

### FASE 1 — AUDITORÍA ESTÁTICA (leer código, NO modificar)

Para cada módulo, verifica:

```typescript
// Checklist por archivo:
□ Sin console.log() sin try/catch (código muerto o debug olvidado)
□ Sin 'any' explícito donde debería haber tipo real
□ Sin getDocs() sin limit() en colecciones grandes
□ Sin fetch/mutación sin manejo de error
□ Sin texto hardcodeado que debería ser variable
□ Estados financieros siempre redondeados con round2()
□ Formularios con validación de campo vacío
□ Modales con role="dialog" aria-modal="true"
□ Botones de ícono con aria-label
□ Inputs con <label> o aria-label
```

**Archivos clave a auditar:**
- `src/features/dashboard/DashboardPage.tsx` — nuevas métricas BI
- `src/features/dashboard/hooks/useDashboardStats.ts` — queries + cálculos
- `src/features/inventory/InventoryPage.tsx` — paginación
- `src/features/inventory/hooks/usePhones.ts` — usePhonesPaginated
- `src/features/inventory/components/ManualForm.tsx` — IMEI Luhn
- `src/features/inventory/validation/phoneSchema.ts` — schema
- `src/features/sales/components/PaymentModal.tsx` — cálculos $
- `src/services/firebase/transactions.ts` — atomic writes
- `src/features/clients/hooks/useClients.ts` — debtAmount edge cases
- `src/features/clients/components/RecordPaymentModal.tsx` — pagos
- `src/features/clients/components/ClientDetailsModal.tsx` — historial
- `src/hooks/useModal.ts` — focus trap
- `firestore.indexes.json` — índices compuestos

### FASE 2 — BUILD CHECK

```bash
npm run build
```

Si hay errores TypeScript: **repáralos inmediatamente** antes de continuar.
Si el build pasa: continúa a Fase 3.

### FASE 3 — PRUEBA DE QUERIES FIRESTORE

Para cada query de Firestore en el código, verifica que:
1. Tenga el índice compuesto necesario en `firestore.indexes.json`
2. Las queries con `(campo1 ==) AND (campo2 range/orderBy)` tienen índice `(campo1 ASC, campo2 ASC/DESC)`
3. Las queries con `in` + `orderBy` tienen índice compuesto

**Índices actualmente en firestore.indexes.json:**
- `(estado ASC, fechaIngreso DESC)` — paginación inventario
- `(lote ASC, fechaIngreso DESC)` — paginación por lote
- `(estado ASC, fechaIngreso ASC)` — stale stock count
- `(estado ASC, fechaVenta DESC)` — recent sales

Si falta algún índice: **agrégalo a firestore.indexes.json**.

### FASE 4 — PRUEBA DE LÓGICA FINANCIERA

Verifica estos cálculos manualmente con valores de prueba:

```typescript
// Test 1: Carrito con 2 items
items = [{price: 150, qty: 1}, {price: 200.5, qty: 2}]
subtotal esperado = $551.00 (round2)
discount = $50
total esperado = $501.00

// Test 2: Margen bruto
precioVenta = $200, costo = $155
margen = (200-155)/200 * 100 = 22.5%

// Test 3: Deuda no negativa
debtAmount = $50, pago = $50
resultado = max(0, round2(50 - 50)) = $0.00

// Test 4: IMEI Luhn válido
imei = "359881090000010" (15 dígitos, válido)
imei = "123456789012345" (15 dígitos, inválido — falla Luhn)
imei = "12345" (< 15 dígitos, inválido)
```

Busca los cálculos en el código y confirma que coinciden.

### FASE 5 — PRUEBA DE ACCESIBILIDAD

Verifica en cada modal que existe:
```
role="dialog"
aria-modal="true"
aria-labelledby o aria-label
dialogRef asignado al contenedor
```

Modales existentes:
- PaymentModal, PhoneModal, RecordPaymentModal, ClientDetailsModal

Verifica en cada tabla:
```
<table aria-label="...">
Checkboxes con aria-label dinámico
Botones de ícono con aria-label
```

### FASE 6 — REPARACIÓN

Por cada problema encontrado:
1. Documenta: **[ARCHIVO:LINEA] Problema → Fix aplicado**
2. Aplica el fix mínimo necesario (no over-engineer)
3. Verifica con `npm run build` que no rompiste nada

### FASE 7 — DEPLOY

Si se aplicaron fixes:
```bash
npm run build && firebase deploy --only hosting
```

Si se agregaron índices:
```bash
firebase deploy --only firestore:indexes,hosting
```

---

## REPORTE FINAL

Al terminar, entrega:

```
## QA Report — Top Line Tec
Fecha: [hoy]

### ✅ Funciona correctamente
- [módulo]: [qué se probó y por qué está bien]

### ❌ Problemas encontrados y reparados
- [ARCHIVO:LINEA] [descripción del bug] → [fix aplicado]

### ⚠️ Problemas conocidos (sin reparar)
- [razón por la que no se reparó, ej: requiere cambio de schema en prod]

### 📊 Métricas
- Archivos auditados: N
- Bugs encontrados: N
- Bugs reparados: N
- Build: ✅ PASS / ❌ FAIL
- Deploy: ✅ OK / ❌ Pendiente
```

---

## NOTAS IMPORTANTES

- **salvinews.xyz = NO TOCAR** — es el sistema viejo en producción
- **Solo deployar a inventario-a6aa3.web.app**
- `fechaIngreso` y `fechaVenta` son strings YYYY-MM-DD en phones (NO Timestamps)
- `paidAt` / `adjustedAt` SÍ son Firestore Timestamps en subcollecciones
- El campo `costo` NO incluye flete/impuestos — no calcular "margen real" con él
- Usar `round2 = (n) => Math.round(n * 100) / 100` en todos los cálculos $
- Firestore `getCountFromServer` y `getAggregateFromServer(sum)` = 1 read cada uno, 0 data descargada

**Ejecuta todas las fases en orden. No saltes ninguna. Si una fase toma más de lo esperado, documenta el motivo y continúa.**
