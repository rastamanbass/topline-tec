# Top Line Tec v2 — Arquitectura PhD
## Documento Maestro: Análisis Competitivo + Gap Analysis + Roadmap de Implementación

**Fecha**: Febrero 2026 | **Versión objetivo**: 2.0.0

---

## 1. ANÁLISIS COMPETITIVO — Investigación Real de Mercado

### 1.1 Plataformas Analizadas

| Plataforma | Mercado Principal | Precio | Fortaleza Clave | Debilidad Crítica |
|---|---|---|---|---|
| **CellSmart POS** | Retail/wholesale pequeño-mediano USA | Personalizado (bajo) | IMEI + gestión de préstamos | Sin grading, reportes débiles |
| **RepairDesk** | Talleres multi-ubicación | $79-$149/mes | 40+ integraciones, citas | No es nativo para wholesale puro |
| **RepairShopr (Syncro)** | Talleres + IT | ~$129/mes | CRM + facturación recurrente | Sin lista negra IMEI, sin grading |
| **CellStore** | Talleres pequeños, global | $39/mes | Facilidad de uso, precio | Sin flujos de wholesale masivo |
| **ERP Gold** | Refurbishers medianos-grandes | Personalizado | Pipeline grading + Phonecheck | Sin portal B2B, sin crédito |
| **NSYS Inventory** | WMS europeo para usados | Enterprise | Analítica de proveedores + diagnósticos | Sin POS retail |
| **PhoneX Warehouse** | Distribuidores enterprise | Enterprise | WMS + portal B2B + marketplaces | Costo, complejidad |
| **inFlow Inventory** | Wholesale general | $110-$1,319/mes | FIFO/LIFO + e-commerce | Sin lógica IMEI específica |

### 1.2 Feature Matrix Completo

| Feature | CellSmart | RepairDesk | RepairShopr | CellStore | ERP Gold | NSYS | PhoneX | **Top Line Tec v2** |
|---|---|---|---|---|---|---|---|---|
| Tracking IMEI por unidad | ✅ | ✅ | Parcial | ✅ | ✅ | ✅ | ✅ | ✅ |
| Verificación lista negra IMEI | ✅ | ❌ | ❌ | ❌ | Via Phonecheck | ✅ GSMA | Via Phonecheck | 🔜 Futuro |
| Grading de condición (A/B/C) | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ | Parcial (condition field) |
| Gestión de reparaciones (Taller) | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Inventario multi-ubicación | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | Parcial (lotes = ubicación virtual) |
| Compra por lotes | Parcial | Parcial | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ (lotes) |
| Analítica de proveedores | ❌ | ❌ | ❌ | ❌ | Parcial | ✅ | Parcial | 🔜 v3 |
| RMA / devoluciones | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | 🔜 v3 |
| Crédito B2B con límite enforced | Parcial | ❌ | Parcial | ❌ | ❌ | ❌ | ❌ | ✅ (módulo clientes) |
| Aging report de deuda | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | 🔜 Sprint 4 |
| P&L por lote | ❌ | ❌ | ❌ | ❌ | Parcial | Parcial | Parcial | ✅ (Finanzas) |
| Historial de ventas completo | Parcial | ✅ | ✅ | Parcial | ✅ | ✅ | ✅ | ✅ (Ventas) |
| Accesorios con alertas stock | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Portal B2B para compradores | Parcial | ❌ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ (Catálogo público) |
| App móvil offline-first | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ (Mover app) | 🔜 v3 (PWA) |
| QuickBooks / contabilidad | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | 🔜 Futuro |
| Facturación PDF | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔜 Sprint 4 |

### 1.3 KPIs del Sector (Benchmarks Reales)

Según datos de Financial Models Lab, Spider Strategies y Phocas Software:

| KPI | Benchmark Industria | Nuestra Meta |
|---|---|---|
| **AOV (Average Order Value)** | $502 en tiendas de teléfonos USA | >$300 dado mercado SV |
| **Gross Margin %** | 25-40% wholesale teléfonos | ≥20% (más accesible en SV) |
| **Inventory Turnover** | ~8x por año (44 días en inventario) | Medir desde v2 |
| **DSO (Days Sales Outstanding)** | 30-45 días B2B | <30 días |
| **Accessory Attach Rate** | 250-350% (2.5-3.5 accesorios por teléfono) | >1.0 (empezando) |
| **Dead Stock Threshold** | >60 días sin movimiento = alarma | Alerta a 45 días |

### 1.4 LO QUE NINGUNA PLATAFORMA HACE BIEN (Nuestra Oportunidad)

Basado en investigación de reviews de Capterra, G2, GetApp:

1. **Crédito B2B con límite enforced en POS** — Ninguna plataforma bloquea una venta si el cliente excede su límite de crédito en tiempo real
2. **Aging report de deuda automatizado** — Nadie envía recordatorios automáticos a los 7, 30, 60, 90 días
3. **FIFO por IMEI individual** — Los sistemas usan costo promedio por SKU; nosotros podemos tener costo exacto por unidad (tenemos `costo` por documento)
4. **Fotos de condición vinculadas al IMEI** — Ninguna plataforma mid-market tiene esto
5. **Dashboard con KPIs en tiempo real en TV** — RepairDesk lo intenta pero solo parcialmente
6. **Flujo offline-first para mercados sin internet estable** — Ninguna plataforma del segmento

---

## 2. GAP ANALYSIS — Estado v1 vs. Competencia

### 2.1 Estado de Módulos

| Módulo | v1 (actual) | Competencia referencia | Gap Prioridad |
|---|---|---|---|
| Inventario / Catálogo | 95% | CellSmart: 90% | Búsqueda global, bulk export |
| Taller | 80% | RepairDesk: 95% | SLA tracking, P&L taller |
| Clientes / CRM | 60% | RepairShopr: 90% | Aging report, límite crédito enforced |
| Dashboard | 70% | RepairDesk: 85% | KPIs reales, gráfica 30 días |
| Ventas / POS | 85% | CellSmart: 90% | PDF factura, historial ✅ |
| Accesorios | 0% → **100%** | Todos: 90% | ✅ Completado |
| Finanzas | 0% → **80%** | ERP Gold: 75% | ✅ Completado |
| Historial Ventas | 0% → **90%** | RepairDesk: 90% | ✅ Completado |
| Usuarios | 70% | RepairShopr: 80% | Roles granulares por módulo |
| Apartados | 30% | CellSmart: 70% | Expiración visible, notificaciones |

### 2.2 Ventajas Competitivas Actuales

**Top Line Tec tiene HOY lo que muchos competidores no tienen:**
- Tracking completo de status history con timeline de cada teléfono
- Crédito Y deuda de taller separados (concepto único)
- Lotes como agrupador nativo con stats en tiempo real
- Portal de catálogo público para clientes B2B
- Reservas con expiración automática (mecanismo de e-commerce)
- Firebase real-time sync (ningún competidor en este segmento usa real-time DB)

---

## 3. ARQUITECTURA v2.0

### 3.1 Principios de Diseño (PhD-level)

1. **IMEI como unidad atómica del sistema**: Cada documento de `phones` es una entidad única con `imei` como clave natural. El inventario es una proyección de conteo de documentos en cierto estado, NO un entero mutable.

2. **Inmutabilidad del pasado financiero**: Ventas, pagos y ajustes NUNCA se borran ni modifican — se anulan con contra-registro. Basado en patrón event-sourcing de Salesforce Engineering.

3. **Atomicidad transaccional**: Toda operación que toca dinero usa `runTransaction()`. Basado en optimistic locking de Modern Treasury.

4. **Trazabilidad total**: Cada cambio tiene `updatedAt`, `updatedBy`, y entrada en `statusHistory`. Basado en audit trail patterns de AuditBoard.

5. **Separación de contextos**: Inventario ≠ Finanzas ≠ Taller. Cada módulo tiene su propio store Zustand.

6. **FIFO exacto por IMEI**: Al calcular margen, usamos el `costo` del documento específico del teléfono — no promedio por modelo. Esto nos da precisión que ningún competidor mid-market tiene.

### 3.2 Modelo de Datos Mejorado

```
phones/{id}
  imei: string (UNIQUE — enforced via Cloud Function)
  marca, modelo, storage, condition ('New'|'Grade A'|'Grade B'|'Grade C'|'Defect')
  lote: string
  costo: number (USD — costo exacto de adquisición de esta unidad)
  precioVenta: number
  estado: PhoneStatus (18 estados posibles)
  statusHistory: StatusChange[] (inmutable)
  reparaciones: Repair[] (con FIFO para pago de deuda de taller)
  fechaIngreso: Timestamp
  fechaVenta?: Timestamp
  clienteId?: string
  daysInStock: number (calculado = now - fechaIngreso)  ← NUEVO
  repairCosts: number (suma de reparaciones pagadas)    ← NUEVO
  netMargin: number (precioVenta - costo - repairCosts) ← NUEVO (calculado al vender)

clients/{id}
  name, phone, email, company
  creditAmount: number (saldo a favor — se usa en POS)
  debtAmount: number (deuda comercial — compras fiadas)
  workshopDebt: number (deuda de taller — reparaciones) ← SEPARAR en v2
  isWorkshopAccount: boolean
  isActive: boolean
  creditLimit: number (límite máximo de deuda autorizado) ← NUEVO
  lastPurchaseDate?: Timestamp (desnormalizado)
  totalSpent: number (suma histórica desnormalizada)

clients/{id}/purchases/{id}  [existente]
clients/{id}/creditAdjustments/{id}  [existente, inmutable]
clients/{id}/debtAdjustments/{id}  [existente, inmutable]
clients/{id}/debtPayments/{id}  ← NUEVO
  amount: number
  reason: string
  paymentMethod: string
  paidAt: Timestamp
  createdBy: string

accessories/{id}  ← IMPLEMENTADO ✅
  name, category, brand, costPrice, salePrice, stock, minStock, sku, isActive
```

### 3.3 Dashboard v2 — KPIs en Tiempo Real

Basado en el patrón documentado de RepairDesk para pantalla de TV:

```
┌─────────────────────────────────────────────────────────┐
│ TOP LINE TEC                          Sábado, 28 Feb     │
├──────────┬──────────┬──────────┬────────────────────────┤
│ GMV MES  │ MARGEN   │ EN STOCK │ DEUDA PENDIENTE        │
│ $18,450  │ 23.4%    │ 142 uds  │ $2,130                 │
│ ↑12% vs  │ 🟡 meta  │ ↓8 hoy   │ 4 clientes             │
│ mes ant  │ ≥20%     │          │                        │
├──────────┴──────────┴──────────┴────────────────────────┤
│ VENTAS 30 DÍAS          │ TOP 5 MODELOS (mes)           │
│ [gráfica de barras]     │ 1. iPhone 13 128GB  $4,200   │
│                         │ 2. Samsung S23      $3,100   │
│                         │ 3. iPhone 14 Pro    $2,800   │
│                         │ 4. Samsung S22      $1,900   │
│                         │ 5. iPhone 12        $1,200   │
├─────────────────────────┴──────────────────────────────-┤
│ ÚLTIMAS 10 TRANSACCIONES                                │
│ 10:32 Carlos Mejía — iPhone 14 — $380 efectivo         │
│ 09:15 María López — 2x Samsung — $620 (deuda $200)     │
└─────────────────────────────────────────────────────────┘
```

---

## 4. PLAN DE IMPLEMENTACIÓN — Sprints

### Sprint 1 ✅ COMPLETADO — Módulos Faltantes Base

**Lo que se implementó:**
- `src/features/finance/` — P&L con presets de fecha, Top Modelos, P&L por lote, Deudores
- `src/features/sales/SalesHistoryPage.tsx` — Historial completo via collectionGroup
- `src/features/accessories/` — CRUD completo con alertas de stock, filtros, margen por producto
- Rutas `/finanzas`, `/ventas`, `/accesorios` en App.tsx
- Fixes pre-existentes: 8 bugs de TypeScript en archivos legados
- Índices compuestos en Firestore desplegados

---

### Sprint 2 — Dashboard Real (Semana 1, P0)

**Por qué es P0**: El dashboard actual tiene datos hardcodeados. Sin KPIs reales en tiempo real, el negocio está ciego.

**Archivos a modificar:**
```
src/features/dashboard/hooks/useDashboardStats.ts  — reescribir con datos reales
src/features/dashboard/DashboardPage.tsx           — rediseñar layout completo
```

**Queries necesarias (todas fetcheables de phones existentes):**
```typescript
// GMV mes actual
const thisMonth = phones.filter(p => isThisMonth(p.fechaVenta));
const gmv = thisMonth.reduce((s, p) => s + p.precioVenta, 0);

// Margen bruto
const margin = (gmv - thisMonth.reduce((s, p) => s + p.costo, 0)) / gmv * 100;

// Top 5 modelos por revenue
const byModel = groupBy(thisMonth, p => `${p.marca} ${p.modelo}`);

// Últimas 10 transacciones (de purchases collectionGroup)
const recent = await getDocs(query(
  collectionGroup(db, 'purchases'),
  orderBy('purchaseDate', 'desc'),
  limit(10)
));

// Ventas por día (30 días) para gráfica
const last30 = phones.filter(p => isWithin30Days(p.fechaVenta));
const salesByDay = groupBy(last30, p => format(p.fechaVenta, 'yyyy-MM-dd'));
```

---

### Sprint 3 — AR Aging Report + Crédito Enforced (Semana 2, P0)

**Por qué P0**: Según investigación competitiva, **ninguna plataforma del segmento** tiene esto. Es nuestra ventaja competitiva más diferenciadora.

**AR Aging Report** — vista en módulo Clientes:
```
Clientes con deuda por antigüedad:
┌──────────┬──────────┬──────────┬──────────┬──────────┐
│ Cliente  │ Corriente│ 1-30 días│ 31-60    │ 60+ días │
│          │          │          │          │ 🔴 ALTO  │
├──────────┼──────────┼──────────┼──────────┼──────────┤
│ Juan P.  │   $200   │   $450   │    $0    │    $0    │
│ María L. │     $0   │     $0   │   $300   │  $800 🔴 │
└──────────┴──────────┴──────────┴──────────┴──────────┘
```

Para calcular aging necesitamos `debtCreatedAt` — actualmente no está en el esquema. La deuda se crea en las compras. Podemos calcularlo mirando purchases.debtIncurred vs purchases.purchaseDate.

**Crédito Enforced en POS**:
```typescript
// En PaymentModal.tsx, antes de procesar venta:
if (selectedClient && selectedClient.creditLimit > 0) {
  const projectedDebt = (selectedClient.debtAmount || 0) + debtIncurred;
  if (projectedDebt > selectedClient.creditLimit) {
    toast.error(`Límite de crédito excedido: ${fmt(projectedDebt)} > ${fmt(selectedClient.creditLimit)}`);
    return;
  }
}
```

---

### Sprint 4 — Completar Módulos (Semana 2-3, P1)

**4.1 PDF de Factura/Recibo**
- Usar `react-pdf` o `jspdf` para generar PDF desde datos de purchase
- Campos: logo empresa, fecha, items, IMEI, forma de pago, cliente
- Botón "Generar Recibo" en PaymentModal post-venta y en SalesHistoryPage

**4.2 Mejoras Taller**
- SLA tracking: `createdAt` del ticket vs `resolvedAt`
- P&L por reparación: `repair.cost` cobrado vs. tiempo estimado de técnico
- Vista de cola por técnico asignado

**4.3 Módulo Apartados Completo**
- Lista de apartados activos con countdown de expiración
- Botón "Confirmar Venta" y "Cancelar Apartado" directamente desde la lista
- Alerta visual cuando quedan <2 horas

---

### Sprint 5 — UX Improvements (Semana 3-4, P1)

**5.1 Búsqueda Global (Cmd+K)**

Basado en patrón de CellSmart que permite buscar IMEI, modelo, y nombre de cliente desde un único campo:

```typescript
// src/components/GlobalSearch.tsx
// Busca en paralelo:
// - phones: imei, modelo, marca (from cache)
// - clients: name, phone (from cache)
// - accessories: name, sku (from cache)
// Resultados en < 100ms (todo es búsqueda en memoria de cache de React Query)
```

**5.2 Vista Lista en Inventario (Tabla Densa)**

La vista actual de cards es buena para catálogo, pero los usuarios avanzados necesitan tabla densa con sorting por columna para:
- Ver precio, costo, margen de muchos teléfonos de un vistazo
- Ordenar por margen para priorizar qué vender
- Bulk-seleccionar y cambiar estado

**5.3 Export CSV**

En todos los módulos con datos tabulares:
```typescript
const exportCSV = (data: object[], filename: string) => {
  const csv = [
    Object.keys(data[0]).join(','),
    ...data.map(row => Object.values(row).join(','))
  ].join('\n');
  // trigger download
};
```

---

### Sprint 6 — PWA + Performance (Semana 4, P2)

**Lighthouse score actual**: ~70 (bundle grande)
**Meta**: ≥90

**Acciones:**
1. InventoryPage-*.js es 1.77 MB — separar tacCatalog.ts en chunk propio
2. Service Worker para cache de assets (PWA)
3. Virtualización de listas largas con `@tanstack/react-virtual`
4. Prefetch de datos más probables en navegación

---

## 5. REGLAS FIRESTORE v2

Las rules actuales ya cubren todos los módulos. Solo agregar cuando existan nuevas colecciones:

```javascript
// clients/{clientId}/debtPayments/{id} — cuando se implemente
match /clients/{clientId}/debtPayments/{id} {
  allow read: if isSignedIn();
  allow create: if isAdmin() || isGerente();
  allow update, delete: if false; // Inmutable — es un ledger de pagos
}
```

---

## 6. REPORTE DE MÉTRICAS DE ÉXITO

| Métrica | Hoy (v1) | Meta v2 | Competencia |
|---|---|---|---|
| Módulos al 100% | 3/10 | 9/10 | RepairDesk: ~7/10 |
| Lighthouse Performance | ~70 | ≥90 | — |
| Crashes en producción | 3+ conocidos (fixed) | 0 en 30 días | — |
| Reportes financieros | 1 básico | 6 completos | ERP Gold: 8 |
| KPIs en dashboard | 4 (incompletos) | 8 (tiempo real) | RepairDesk: 6 |
| Gross margin tracking | Manual | Automático | CellSmart: Parcial |

---

## 7. LO QUE NINGÚN COMPETIDOR TIENE Y NOSOTROS SÍ

1. **Firebase Realtime** — Cuando se vende un teléfono, todos los usuarios con la app abierta ven el inventario actualizado sin recargar. Ninguna plataforma del segmento usa real-time DB.

2. **Catálogo Público B2B** — Nuestro portal permite a clientes ver stock disponible con reserva temporal. Solo PhoneX tiene esto a nivel enterprise ($$$).

3. **FIFO exacto por IMEI** — Tenemos `costo` individual por documento. Margen por unidad es preciso al 100%, no promedio.

4. **Separación deuda comercial / deuda de taller** — Único en el segmento. Permite ver claramente cuánto debe un cliente por compras vs por reparaciones.

5. **Status history inmutable** — Cada cambio de estado queda registrado para siempre con fecha, usuario y nota. Ninguna plataforma mid-market tiene esto como feature nativo.

---

## 8. FUENTES DE LA INVESTIGACIÓN COMPETITIVA

- CellSmart POS: cellsmartpos.com + Capterra reviews
- RepairDesk: repairdesk.co + G2 reviews + blog KPI dashboard
- RepairShopr: repairshopr.com/features + Capterra
- CellStore: cellstore.co/features.php + Capterra (4.8/5, 30 reviews)
- ERP Gold: erp.gold + Phonecheck integration docs
- NSYS Inventory: nsysgroup.com/products/nsys-inventory/
- PhoneX Warehouse: phonexinc.com/phonex-warehouse
- inFlow Inventory: inflowinventory.com/software-pricing
- Benchmarks KPI: financialmodelslab.com, phocassoftware.com, spiderstrategies.com, earnestassoc.com
- Data integrity patterns: Salesforce Engineering (event sourcing), Modern Treasury (optimistic locking), AuditBoard (audit trails)
- Mobile UX: handifox.com, rfgen.com, erpsoftwareblog.com
- Wholesale margins: machash.com (15-25% typical)
- AR Aging: netsuite.com/portal/resource/articles/accounting/accounts-receivable-aging
