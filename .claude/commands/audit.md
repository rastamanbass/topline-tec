# /audit — Auditoría Completa Top Line Tec

Eres un ingeniero senior con experiencia en Firebase, React 19, TypeScript y seguridad de aplicaciones SaaS. Vas a realizar una auditoría COMPLETA y EXHAUSTIVA del sistema Top Line Tec, una aplicación mayorista de teléfonos usada en producción en `inventario-a6aa3.web.app`. La empresa es estadounidense y envía teléfonos desde USA a El Salvador.

**Esta es la auditoría que determina si la app vale $10,000 USD. Sé implacable.**

---

## CONTEXTO DEL SISTEMA

- **Stack**: React 19 + TypeScript + Vite 7 + Firebase 12 (Firestore + Auth + Hosting + Functions) + TailwindCSS 4
- **Roles**: `admin` | `gerente` | `vendedor` | `comprador` | `taller`
- **Colecciones Firestore**: `phones`, `clients`, `users`, `accessories`, `batches`, `shipments`, `pendingOrders`, `receivingReports`, `price_catalog`, `device_definitions`
- **Subcollecciones**: `clients/{id}/purchases`, `clients/{id}/debtPayments`, `clients/{id}/debtAdjustments`, `clients/{id}/creditAdjustments`
- **Rutas**: `/dashboard`, `/inventory`, `/clients`, `/workshop`, `/receiving`, `/insights`, `/finance`, `/accessories`, `/sales`, `/users`, `/catalogo`, `/mis-pedidos`, `/ordenes`, `/checkout/success`, `/checkout/cancel`
- **Cloud Functions**: `createStripeCheckout`, `stripeWebhook`, `createPayPalOrder`, `capturePayPalOrder`, `confirmTransferPayment`
- **Ruta del proyecto**: `/Users/danielabrego/Projects/topline-tec/`

---

## INSTRUCCIONES GENERALES

1. Lee cada archivo antes de emitir un veredicto sobre él
2. Verifica CADA bug con evidencia de código (archivo:línea)
3. Para bugs de seguridad: clasifica como CRÍTICO / ALTO / MEDIO / BAJO
4. Para bugs de lógica: clasifica como BLOQUEANTE / IMPORTANTE / MENOR
5. Si encuentras un bug que puedes reparar automáticamente, REPÁRALO sin pedir permiso
6. Si un fix requiere decisión de negocio, documenta el problema pero no lo toques
7. Al final de CADA fase, ejecuta `npm run build` desde `/Users/danielabrego/Projects/topline-tec/` para verificar que no hay regresiones TypeScript
8. Ejecuta el build final una última vez al terminar todo
9. **NO hacer `firebase deploy` en ningún momento**

---

## FASE 1 — AUDITORÍA DE SEGURIDAD

### 1.1 Firestore Rules
Lee `firestore.rules` completamente y verifica:

**CHECKS OBLIGATORIOS:**
- [ ] ¿Puede un `comprador` leer documentos de otro comprador en `pendingOrders`? (debe filtrarse por `clientId == request.auth.uid`)
- [ ] ¿Puede un `vendedor` crear o modificar `users`? (solo `admin` debe poder)
- [ ] ¿Puede cualquier usuario autenticado escribir `price_catalog`? (actualmente `isSignedIn()` — ¿es intencional o es un agujero?)
- [ ] ¿Las subcollecciones de `clients` (debtPayments, debtAdjustments) permiten escritura a `vendedor`? (solo admin/gerente deben poder)
- [ ] ¿Los teléfonos en estado público (`En Stock`) exponen campos sensibles como `costo`, `lote`, `clienteId`? (las reglas de Firestore no filtran campos individuales — documentar como riesgo)
- [ ] ¿Existe un catch-all `match /{document=**}` que deniegue todo lo no explícito?
- [ ] ¿Las reglas de `shipments` permiten que un comprador vea shipments de otros compradores? (actualmente `isSignedIn()` sin filtro por clientId — mejorarlo)
- [ ] ¿El campo `reservation` en `phones` puede ser escrito por cualquier usuario autenticado sin límite de rate?

**FIX SI ENCUENTRAS PROBLEMAS:** Edita `firestore.rules` directamente con mejoras concretas.

### 1.2 AuthContext — CRÍTICO
Lee `src/context/AuthContext.tsx` completamente y verifica:
- [ ] Existe un `TODO: Remove emergency fallbacks before production` en la línea 76 — ¿qué hace ese fallback exactamente? ¿puede un usuario sin documento en Firestore asumir un rol elevado?
- [ ] ¿El rol se lee SOLO de Firestore (`users/{uid}.role`)? ¿O hay un fallback que asigne roles por defecto (ej: `'vendedor'` o peor `'admin'`)?
- [ ] ¿Hay race condition entre `onAuthStateChanged` y la lectura del rol? ¿Puede haber un momento donde `userRole` sea `null` pero el usuario ya está autenticado, dándole acceso a rutas protegidas?
- [ ] ¿Los `console.warn` exponen información de UIDs o roles en producción?
- [ ] Si el TODO indica fallback peligroso: ELIMINARLO y forzar que sin documento en Firestore el usuario sea redirigido al login

### 1.3 Cloud Functions (`functions/src/index.ts`)
Lee el archivo completo y verifica:
- [ ] ¿`confirmTransferPayment` valida que el llamante tenga rol `admin` o `gerente` consultando `users/{uid}` en Firestore Admin SDK antes de proceder?
- [ ] ¿`stripeWebhook` usa `stripe.webhooks.constructEvent` con `req.rawBody` (no `req.body`)? Si usa `req.body` ya parseado, la firma NUNCA validará correctamente
- [ ] ¿`markOrderPaid` es idempotente? Dentro del `runTransaction`, ¿verifica que `order.status !== 'paid'` antes de proceder? Si no, podría duplicar registros de compra
- [ ] ¿`createStripeCheckout` verifica que `order.reservedUntil > now` antes de crear la sesión de Stripe? Si la reserva expiró, no debería crear el checkout
- [ ] ¿Los secrets (`STRIPE_SECRET_KEY`, `PAYPAL_CLIENT_ID`, etc.) se leen de `process.env` (secrets de Firebase) y NUNCA están hardcodeados?
- [ ] ¿`cancelOrderAndReleasePhones` verifica que el teléfono esté en estado `Apartado` antes de regresarlo a `En Stock`? Si ya fue vendido por otro canal y luego el stripe expira, no debería sobreescribir el estado
- [ ] ¿Hay manejo de errores en `getPayPalAccessToken`? Si PayPal está caído, ¿la función falla gracefully?

### 1.4 Exposición de datos sensibles
Ejecuta estos greps y analiza resultados:
```bash
grep -rn "costo\|lote\|clienteId" src/features/public/ --include="*.tsx" --include="*.ts"
grep -rn "imei" src/features/public/ --include="*.tsx" --include="*.ts"
```
- [ ] ¿El catálogo público (`PublicCatalogPage`, `PublicPhoneCard`) muestra el IMEI? (identificador único que no debe exponerse públicamente)
- [ ] ¿El catálogo público muestra el precio de `costo`? (solo debería mostrar `precioVenta`)
- [ ] ¿`console.error` en hooks expone datos de clientes, tokens o UIDs? Revisar especialmente `useClients.ts` y `transactions.ts`

---

## FASE 2 — AUDITORÍA DE LÓGICA FINANCIERA

### 2.1 Precisión monetaria
Lee `src/services/firebase/transactions.ts`, `src/features/sales/components/PaymentModal.tsx`, `src/features/clients/hooks/useClients.ts`, y `src/features/dashboard/hooks/useDashboardStats.ts`.

- [ ] ¿TODAS las operaciones monetarias usan `round2 = Math.round(n * 100) / 100`? Busca cualquier suma/resta/multiplicación de precios que no pase por `round2`
- [ ] ¿`debtAmount` puede quedar negativo? Busca todos los lugares donde se modifica `debtAmount` — ¿todos tienen `Math.max(0, ...)`?
- [ ] ¿`creditAmount` puede quedar negativo si se aplica más crédito del disponible? ¿Hay validación en `PaymentModal` de que `amountPaidWithCredit <= client.creditAmount`?
- [ ] ¿`precioVenta - costo` puede ser negativo (venta a pérdida) sin ninguna advertencia al usuario admin?
- [ ] ¿`amountPaidWithWorkshopDebt` se aplica correctamente al `debtAmount` de la cuenta de taller en `transactions.ts`?
- [ ] ¿Las transacciones Firestore (`runTransaction`) son verdaderamente atómicas? ¿O hay writes FUERA de la transacción que podrían ejecutarse parcialmente?
- [ ] ¿El campo `total` en `PendingOrder` se verifica server-side (en Cloud Functions) antes de procesar el pago? ¿O confía en el valor enviado por el cliente?

### 2.2 Traza del flujo de venta completo
Sigue el código desde `PaymentModal.handleSubmit` → `transactions.ts:createSaleTransaction` → Firestore:
- [ ] ¿Se crea el registro en `clients/{id}/purchases` SIEMPRE, o solo en algunos casos (ej: si `clientId` es null, ¿qué pasa)?
- [ ] ¿El `precioVenta` final se guarda en el documento del teléfono al venderlo?
- [ ] ¿`fechaVenta` se setea como la fecha actual al momento de la venta?
- [ ] ¿`statusHistory` del teléfono se actualiza con `arrayUnion` al vender?

### 2.3 Deuda de taller y reconciliación
- [ ] En `useDashboardStats.ts`, `workshopDebt` = suma de `repair.cost` donde `repair.paid === false` en teléfonos vendidos este mes. ¿Es eso coherente con cómo el negocio entiende "deuda de taller"?
- [ ] ¿El flag `repair.paid` se actualiza correctamente desde algún lugar del código? ¿Dónde se marca un repair como pagado?

---

## FASE 3 — AUDITORÍA DE FIRESTORE (QUERIES, ÍNDICES, SEGURIDAD)

### 3.1 Queries sin límite
Ejecuta:
```bash
grep -rn "getDocs\|getDoc" src/ --include="*.ts" --include="*.tsx" | grep -v "test\|\.test\." | grep -v "limit("
```
Para cada resultado: ¿cuántos documentos podría retornar en producción? Las colecciones `phones` y `clients` pueden tener cientos o miles de documentos. Agrega `limit()` a todas las queries que no lo tengan, con un valor conservador (200-500 según el caso).

### 3.2 Índices de Firestore
Lee `firestore.indexes.json` completo. Luego cruza con las queries de los hooks. Verifica que existen índices para:
- [ ] `phones`: `where('estado', ...) + orderBy('fechaVenta', 'desc')` — necesario para `getRecentSales` y `getSoldPhonesInRange`
- [ ] `phones`: `where('estado', '==', ...) + where('fechaIngreso', '<=', ...)` — necesario para `getStaleStockCount`
- [ ] `pendingOrders`: `where('clientId', '==', ...) + orderBy('createdAt', 'desc')` — necesario para `MyOrdersPage`
- [ ] `shipments`: `orderBy('createdAt', 'desc')` — necesario para `useShipments`
- [ ] `shipments`: `where('orderId', '==', ...) + limit(1)` — ¿necesita índice o es single field?

Para cada índice faltante: agrégalo a `firestore.indexes.json`.

### 3.3 Reads innecesarios y optimización de costos
- [ ] `useClients()` en `useDashboardStats.ts` carga TODOS los clientes (hasta 500 docs) solo para sumar `debtAmount`. ¿Se puede reemplazar con `getAggregateFromServer(sum('debtAmount'))` igual que se hace con `getSumCosto`? Si es posible, implementarlo
- [ ] ¿Hay hooks que ejecutan queries aunque el usuario no tenga el rol adecuado para verlos? (ej: un `comprador` que activa `useDashboardStats`)
- [ ] ¿`staleTime` está configurado en los hooks más costosos para evitar refetch en cada navegación?

### 3.4 Queries que podrían fallar en producción
- [ ] ¿Hay queries con `where` sobre múltiples campos que no tienen índice compuesto declarado?
- [ ] ¿Las queries de `getAggregateFromServer` tienen sus índices necesarios? (Firestore a veces requiere índices adicionales para aggregations)

---

## FASE 4 — AUDITORÍA DE CÓDIGO MUERTO Y DEUDA TÉCNICA

### 4.1 Archivos duplicados o huérfanos
Verifica en `src/App.tsx` cuáles rutas se importan y cuáles no:

```bash
grep -n "import\|lazy(" src/App.tsx
```

Luego verifica existencia y uso de:
- [ ] `src/features/public/ClientStorePage.tsx` (raíz de public/) vs `src/features/public/pages/ClientStorePage.tsx` — leer ambos, determinar cuál está en App.tsx y eliminar el huérfano
- [ ] `src/features/dashboard/Dashboard.tsx` vs `src/features/dashboard/DashboardPage.tsx` — ¿cuál se usa? ¿el otro es dead code?
- [ ] `src/features/inventory/hooks/useAccessories.ts` vs `src/features/accessories/hooks/useAccessories.ts` — ¿son el mismo hook duplicado o tienen contenido diferente? Leer ambos y comparar
- [ ] `src/utils/seedData.ts` — ejecutar `grep -rn "seedData" src/ --include="*.tsx" --include="*.ts"` — si no se importa desde producción, documentar como deuda técnica
- [ ] `src/utils/MIT_Analyzer.cjs` — archivo `.cjs` en `src/` de una app React+Vite. Leer para entender qué hace. ¿Debería estar en `src/`?
- [ ] `src/utils/reparse.js` — archivo `.js` en proyecto TypeScript. Leer y determinar si es dead code

### 4.2 Componentes de testing en bundle de producción
```bash
grep -rn "BrainInjector\|SeederButton\|DataRepairButton\|BatchManager" src/ --include="*.tsx" --include="*.ts" | grep -v "test\|\.test\."
```
- [ ] ¿Alguno de estos se importa desde una página o ruta activa en `App.tsx`?
- [ ] Si están en el bundle: ¿tienen guard `userRole === 'admin'`? ¿Pueden ejecutar writes no autorizados en Firestore?
- [ ] Si son completamente huérfanos: documentar pero no eliminar (pueden ser necesarios para operaciones de emergencia)

### 4.3 TODOs críticos — resolver
**TODO 1** — `src/context/AuthContext.tsx` línea ~76: `TODO: Remove emergency fallbacks before production`
- Leer el bloque completo donde está el TODO
- Si el fallback asigna `role: 'admin'` o `role: 'gerente'` a usuarios sin documento → **BUG CRÍTICO DE SEGURIDAD** — eliminar inmediatamente
- Si asigna `role: 'vendedor'` → bug menor pero debe documentarse
- Si asigna `role: 'comprador'` → aceptable temporalmente pero documentar
- Aplicar el fix correspondiente

**TODO 2** — `src/features/workshop/WorkshopPage.tsx` línea ~34: `TODO: check if client exists logic`
- Leer el contexto completo
- Si puede crear registros de reparación con un `clientId` que no existe en Firestore → bug de integridad de datos
- Documentar el impacto y si es seguro añadir la validación, hacerlo

### 4.4 Console statements
```bash
grep -rn "console\.log\b" src/ --include="*.ts" --include="*.tsx" | grep -v "test\|\.test\."
```
- Eliminar todos los `console.log` encontrados en código de producción (no en utilidades/seeds)
- Los `console.error` y `console.warn` en bloques catch son aceptables — solo verificar que no expongan datos sensibles

---

## FASE 5 — AUDITORÍA DE ACCESIBILIDAD (WCAG 2.1 AA)

### 5.1 Modales — focus management
Para CADA modal en el codebase (lee al menos PhoneModal, ClientModal, PaymentModal, ShipmentModal, CheckoutModal):
- [ ] ¿Tiene `role="dialog"` y `aria-modal="true"`?
- [ ] ¿Tiene `aria-labelledby` apuntando al `id` del elemento de título?
- [ ] ¿Tiene un handler `onKeyDown` para cerrar con `Escape`?
- [ ] Al abrir el modal: ¿el foco se mueve al primer elemento interactivo dentro del modal?
- [ ] Al cerrar el modal: ¿el foco regresa al elemento que lo abrió?
- [ ] ¿El backdrop/overlay tiene `aria-hidden="true"` para lectores de pantalla?

Si falta alguno de estos en los modales principales (PhoneModal, PaymentModal, ClientModal): agrega el atributo o handler correspondiente.

### 5.2 Formularios
Para `PhoneModal` (el más complejo) y `LoginPage`:
- [ ] ¿Cada input tiene `<label htmlFor="...">` o `aria-label`?
- [ ] ¿Los mensajes de error de validación tienen `role="alert"` para ser anunciados automáticamente?
- [ ] ¿Los campos requeridos tienen `required` o `aria-required="true"`?
- [ ] ¿Los selects tienen label asociado?

### 5.3 Contraste de colores (verificar clases Tailwind)
- [ ] `text-emerald-600 bg-emerald-50` — ratio de contraste ≈ 3.2:1 (FALLA WCAG AA para texto normal). Cambiar a `text-emerald-700 bg-emerald-50` (ratio ≈ 4.6:1)
- [ ] `text-amber-600 bg-amber-50` — ratio ≈ 2.9:1 (FALLA). Cambiar a `text-amber-700 bg-amber-100`
- [ ] `text-gray-400` sobre fondo blanco — ratio ≈ 2.8:1 (FALLA para texto normal). Solo es aceptable para texto decorativo/placeholder
- Si encuentras estos patrones en badges o texto importante: corregirlos a variantes con suficiente contraste

### 5.4 Tablas semánticas
Para `PhoneTable` y `ClientTable`:
- [ ] ¿`<thead>` tiene `<th scope="col">` en cada header?
- [ ] ¿La tabla tiene `aria-label` descriptivo?
- [ ] ¿Las celdas de checkbox tienen `aria-label` dinámico por fila?

---

## FASE 6 — AUDITORÍA DE PERFORMANCE Y REACT

### 6.1 Bundle size — InventoryPage (1.69 MB)
Lee `src/features/inventory/InventoryPage.tsx` y verifica todos sus imports directos e indirectos:
- [ ] ¿Los modales (`PhoneModal`, `PhoneDetailsModal`) se importan con `lazy()` o directamente?
- [ ] ¿Hay imports de librerías grandes (recharts, etc.) dentro del inventory bundle?
- [ ] ¿`BrainInjector`, `SeederButton`, `DataRepairButton` están importados en InventoryPage aunque no se usen en producción?

Si hay modales importados directamente (no con lazy): convertirlos a lazy imports con `React.lazy(() => import('./components/PhoneModal'))`.

### 6.2 Memory leaks — useEffect sin cleanup
```bash
grep -rn "useEffect" src/ --include="*.ts" --include="*.tsx" -A 5 | grep -B 2 "onSnapshot\|setInterval\|addEventListener"
```
Para cada `onSnapshot` dentro de `useEffect`:
- [ ] ¿Retorna la función de unsubscribe? (`return unsubscribe`)
- [ ] Si no: agregar el cleanup correspondiente

### 6.3 Error Boundaries
```bash
grep -rn "ErrorBoundary\|componentDidCatch" src/ --include="*.ts" --include="*.tsx"
```
- [ ] ¿Existe un ErrorBoundary component?
- [ ] ¿Está aplicado al menos en el nivel de rutas en `App.tsx`?
- [ ] ¿La ruta pública `/catalogo` tiene error boundary propio? (accesible sin auth)

Si no existe ErrorBoundary: crear uno simple en `src/components/ErrorBoundary.tsx` y aplicarlo en `App.tsx` envolviendo las rutas.

### 6.4 Re-renders en PhoneTable
- [ ] La selección de checkboxes (`selectedPhoneIds`) está en el store de Zustand. ¿Cada checkbox row hace subscribe al store completo, causando re-render de TODAS las filas al seleccionar una?
- [ ] Si es así: el componente de cada fila debería hacer `useInventoryStore(s => s.selectedPhoneIds.has(phone.id))` para suscribirse solo a su propio estado

---

## FASE 7 — AUDITORÍA DE FLUJOS DE NEGOCIO

### 7.1 Máquina de estados de teléfonos
Lee `src/types/index.ts` (tipo `PhoneStatus`) y `src/features/inventory/components/StatusChangeModal.tsx`:
- [ ] ¿Existen transiciones de estado inválidas? Por ejemplo: ¿puede ir de `'Entregado al Cliente'` a `'En Stock'` directamente sin pasar por `'En Bodega (USA)'`?
- [ ] ¿Cuáles transiciones están permitidas desde cada estado? ¿Hay una lista de transiciones válidas o cualquier usuario puede cambiar a cualquier estado?
- [ ] ¿`fechaVenta` se setea automáticamente cuando el teléfono pasa a `'Vendido'`? Si depende del usuario ingresarla manualmente, puede quedar vacía
- [ ] ¿`statusHistory` del teléfono se actualiza cuando el estado cambia por el flujo de checkout online (Cloud Functions)? Verificar en `functions/src/index.ts` → `markOrderPaid`

### 7.2 Flujo de envíos — atomicidad y consistencia
Lee `src/features/orders/hooks/useShipments.ts` y verifica `useUpdateShipmentStatus`:
- [ ] ¿El `writeBatch` actualiza atómicamente: (1) shipment.status, (2) pendingOrder.status='delivered', (3) phones[].estado='Entregado al Cliente'? Si alguno falla, ¿el batch completo hace rollback?
- [ ] ¿Puede existir más de un `shipment` para la misma `orderId`? La query en `useOrderShipment` hace `limit(1)` pero no previene la creación de duplicados. Documentar como riesgo
- [ ] ¿El índice para `where('orderId', '==', orderId)` en `shipments` existe en `firestore.indexes.json`? (single field equality no necesita índice compuesto, pero verificar)

### 7.3 Flujo de pagos online
- [ ] ¿`CheckoutSuccessPage` verifica el estado real de la orden en Firestore con el `orderId` de la URL, o solo muestra un mensaje genérico de éxito confiando en que el webhook ya procesó todo?
- [ ] ¿Qué pasa si un usuario manipula el `?order_id=` en la URL de success para ver órdenes de otros? ¿La query verifica que `clientId === user.uid`?
- [ ] ¿Las reservas expiradas (`reservedUntil < now`) se limpian automáticamente? ¿O quedan teléfonos en estado `Apartado` indefinidamente si el webhook de Stripe no llega?

### 7.4 Módulo de clientes — validaciones
Lee `src/features/clients/hooks/useClients.ts` → `useRecordDebtPayment`:
- [ ] ¿Puede procesar un pago de `amount = 0` o negativo? Agregar validación `if (roundedAmount <= 0) throw new Error('El monto debe ser positivo')`
- [ ] ¿`useAddDebtAdjustment` puede crear ajustes que lleven `debtAmount` a negativo? ¿Tiene validación o simplemente escribe el ajuste sin verificar el resultado?
- [ ] ¿La diferencia entre `debtAdjustments` y `creditAdjustments` está clara en el código y en las reglas de Firestore? ¿Se usan consistentemente o hay confusión?

---

## FASE 8 — AUDITORÍA DE TYPESCRIPT

### 8.1 Casts inseguros
```bash
grep -rn "as unknown as\| as any\| \!\." src/ --include="*.ts" --include="*.tsx" | grep -v "test\|\.test\.\|node_modules"
```
Para cada `as unknown as`: ¿es necesario o hay forma de tipar correctamente?
Para cada `!.` (non-null assertion): ¿puede realmente ser null en runtime? Si sí → bug potencial

### 8.2 Timestamps de Firestore
Los timestamps de Firestore son `Timestamp` objects, no `Date` ni `string`. Verificar:
- [ ] ¿`phone.fechaIngreso` y `phone.fechaVenta` están tipados correctamente como `string` en `types/index.ts`? (son strings ISO YYYY-MM-DD según la arquitectura)
- [ ] ¿`createdAt`, `updatedAt`, `paidAt` están tipados como `Timestamp | null` en los tipos de `PendingOrder` y `Client`?
- [ ] En `MyOrdersPage.tsx`, `fmtDate` recibe `Timestamp | null | undefined` y llama `.toDate()`. ¿Qué pasa si es un string (edge case de datos legacy)?

### 8.3 Build verification después de todos los fixes
```bash
cd /Users/danielabrego/Projects/topline-tec && npm run build 2>&1
```
Confirmar que termina con `✓ built in X.XXs` sin errores.

---

## FASE 9 — REPARACIONES AUTOMÁTICAS

### Lo que DEBES reparar sin preguntar:
1. Imports no usados que causan error TS6133
2. `console.log` en código de producción (no seeds/utils) → eliminar
3. Queries sin `limit()` en colecciones grandes → agregar `limit(200)` mínimo
4. Fallback de rol peligroso en AuthContext → eliminar si asigna rol admin/gerente por defecto
5. Índices faltantes en `firestore.indexes.json` → agregar
6. Archivos duplicados claramente huérfanos (verificar primero con grep que no se importan) → eliminar
7. `text-emerald-600` en badges → cambiar a `text-emerald-700` por contraste
8. Modales sin `aria-modal="true"` y `role="dialog"` → agregar atributos
9. `useUpdateShipmentStatus` con `amount = 0` sin validar → agregar guard
10. Cualquier bug TypeScript que cause fallo de build

### Lo que NO tocar (requiere decisión de negocio):
- La estructura de estados de teléfonos (el negocio decidió esas transiciones)
- El precio de `costo` visible internamente vs externamente (puede ser intencional para algunas vistas internas)
- Los permisos de `price_catalog` que permiten escritura a cualquier usuario autenticado (puede ser intencional para el Brain 2.0)
- La lógica de workshopDebt que puede ser correcta según las reglas del negocio salvadoreño

---

## FASE 10 — REPORTE FINAL

Después de completar todas las fases, hacer todas las reparaciones, y confirmar el build:

### Build final obligatorio
```bash
cd /Users/danielabrego/Projects/topline-tec && npm run build 2>&1
```

### Genera el reporte en este formato:

```
═══════════════════════════════════════════════════════════════
  TOP LINE TEC — AUDITORÍA COMPLETA
  Fecha: [fecha]
  Auditor: Claude Sonnet 4.6 (MIT/Stanford level)
═══════════════════════════════════════════════════════════════

## RESUMEN EJECUTIVO
┌─────────────────────────────────────────────┐
│  Bugs críticos (seguridad):        X        │
│  Bugs bloqueantes (lógica):        X        │
│  Bugs importantes:                 X        │
│  Bugs menores:                     X        │
│  Reparaciones aplicadas:           X        │
│  Decisiones pendientes negocio:    X        │
│  Estado del build:          ✅ PASS / ❌ FAIL│
└─────────────────────────────────────────────┘

## 🔴 SEGURIDAD — CRÍTICOS
[Para cada bug: ARCHIVO:LÍNEA | Descripción | Estado: REPARADO/PENDIENTE]

## 🟠 SEGURIDAD — ALTOS
[...]

## 🟡 SEGURIDAD — MEDIOS/BAJOS
[...]

## 💰 LÓGICA FINANCIERA
[Lista de bugs con archivo:línea y si fue reparado]

## 🔥 FIRESTORE (queries, índices, reglas)
[Lista: BLOQUEANTE/IMPORTANTE/MENOR]

## 🗑️ CÓDIGO MUERTO / DEUDA TÉCNICA
[Lista de archivos huérfanos, duplicados, testing en producción]

## ♿ ACCESIBILIDAD (WCAG 2.1 AA)
[Lista con nivel FAILS/PASSES]

## ⚡ PERFORMANCE / REACT
[Lista de problemas]

## 🔄 FLUJOS DE NEGOCIO
[Lista de inconsistencias o riesgos]

## 📝 TYPESCRIPT
[Lista de problemas de tipos]

## ✅ REPARACIONES APLICADAS EN ESTA SESIÓN
[Lista numerada de cada fix con archivo:línea]

## ⚠️ DECISIONES PENDIENTES PARA EL DUEÑO
[Items con contexto: "Este permiso en firestore.rules parece amplio — ¿es intencional?"]

## 🚀 PRÓXIMOS PASOS (orden de prioridad)
1. [acción concreta con responsable y urgencia]
2. [...]
...

## BUILD FINAL
[Output completo del npm run build]
```

---

**Empieza leyendo `src/context/AuthContext.tsx` y `firestore.rules` (los archivos de mayor riesgo de seguridad) y luego procede por fases. Sé brutal, sé preciso, sé útil. Cada bug que encuentres y no repares es dinero que se pierde.**
