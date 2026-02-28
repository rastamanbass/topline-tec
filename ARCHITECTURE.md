# Top Line Tec v2 — Arquitectura PhD

**Fecha**: Febrero 2026
**Versión objetivo**: 2.0.0
**Autor**: Análisis arquitectónico basado en investigación competitiva y gap analysis completo

---

## 1. ANÁLISIS COMPETITIVO — Lo que los mejores hacen

### CellSmart POS (líder del mercado USA)
- Inventario por IMEI con historial completo de cada unidad
- Seguimiento de reparaciones con tiempos de ciclo y margen por reparación
- CRM integrado con historial de compras por cliente
- Reportes de utilidad por unidad, por lote y por vendedor
- Integración con carriers para verificación de IMEI bloqueado/limpio
- **Clave**: Cada teléfono tiene un "lifetime ledger" — todo lo que entró/salió relacionado a ese IMEI

### NSYS Inventory (único WMS para dispositivos usados)
- Procesamiento por lotes con grading automatizado (A/B/C)
- Trazabilidad ESN/IMEI para compliance regulatorio
- FIFO/FEFO para rotación de inventario y valuación COGS correcta
- Cycle counting sin parar operaciones
- Multi-ubicación (bodega USA → tránsito → bodega SV)
- **Clave**: Separa "inventario físico" de "inventario financiero" (COGS vs valor mercado)

### RepairDesk / RepairShopr
- Tickets de reparación con SLA tracking y notificaciones al cliente
- Partes inventory separado del inventario de dispositivos
- Comisiones automáticas para técnicos
- Customer portal: clientes ven estado de su reparación en tiempo real
- **Clave**: Reparación es su propio centro de costo con P&L separado

### inFlow / Unleashed (wholesale genérico best-in-class)
- Purchase Orders → Receiving → Location → Pick → Invoice flujo completo
- Deuda de clientes con aging reports (0-30 / 31-60 / 61-90 / 90+ días)
- Reorder points automáticos
- **Clave**: Separación clara entre "deuda comercial" y "deuda de taller"

### Patrones UX que dominan el mercado
1. **Dashboard con KPIs en tiempo real**: GMV hoy, stock disponible, deuda pendiente, top 3 movimientos
2. **Búsqueda global instantánea**: Un solo campo busca IMEI, modelo, nombre cliente — en < 200ms
3. **Vista dual Lista/Catálogo**: Toggle con preferencia guardada en localStorage
4. **Bulk actions**: Seleccionar N teléfonos → cambiar estado, asignar lote, exportar
5. **Timeline de actividad**: Cada entidad (teléfono, cliente) tiene un feed cronológico
6. **Offline-first para operaciones críticas**: Registrar venta aunque se corte internet

---

## 2. GAP ANALYSIS — Estado actual vs. Competencia

### MÓDULOS EXISTENTES

| Módulo | Completitud | Gaps Críticos |
|--------|-------------|---------------|
| Inventario (Catálogo) | 95% | Sin búsqueda por estado en URL, sin bulk export |
| Taller | 80% | Sin SLA tracking, sin P&L por reparación |
| Clientes | 60% | Sin aging report, sin separación deuda-comercial/taller |
| Dashboard | 70% | Datos hardcodeados o incompletos, sin KPIs reales |
| Ventas (POS) | 85% | Sin comprobante PDF, sin historial en pantalla |
| Usuarios | 70% | Sin roles granulares por módulo |
| Apartados | 30% | Sin expiración visible, sin notificación |

### MÓDULOS FALTANTES (0%)

| Módulo | Prioridad | Impacto |
|--------|-----------|---------|
| **Finanzas** | P0 | Sin esto no se puede medir rentabilidad |
| **Vendidos** | P0 | Sin historial de ventas no hay auditoría |
| **Accesorios** | P1 | Ingresos secundarios no capturados |

---

## 3. ARQUITECTURA PROPUESTA v2.0

### 3.1 Principios de diseño

1. **Verdad única**: Firestore es la fuente de verdad. La UI es solo una proyección.
2. **Atomicidad financiera**: Toda operación que toca dinero usa `runTransaction()`.
3. **Inmutabilidad del pasado**: Ventas, pagos y ajustes NUNCA se borran — solo se anulan con contra-registro.
4. **Trazabilidad total**: Cada cambio tiene `updatedAt`, `updatedBy`, y entrada en historial.
5. **Separación de contextos**: Inventario ≠ Finanzas ≠ Taller. Cada módulo tiene su propio store.

### 3.2 Modelo de datos mejorado

```
phones/{id}
  imei: string (UNIQUE — enforced via Cloud Function)
  marca, modelo, storage, condition
  lote: string
  costo: number (USD, costo de adquisición)
  precioVenta: number
  estado: PhoneStatus
  statusHistory: StatusChange[]
  repairCosts: number (suma acumulada de costos de taller)
  netCost: number (costo + repairCosts — calculado)
  margin: number (precioVenta - netCost — calculado)
  fechaIngreso: Timestamp
  fechaVenta?: Timestamp
  clienteId?: string
  createdBy: string (UID)
  updatedAt: Timestamp

clients/{id}
  name, phone, email, company
  creditAmount: number (saldo a favor del cliente)
  debtAmount: number (deuda comercial — por compras)
  workshopDebt: number (deuda de taller — reparaciones) ← NUEVO
  isWorkshopAccount: boolean
  isActive: boolean
  totalPurchases: number (contador, desnormalizado)
  totalSpent: number (suma histórica, desnormalizado)
  lastPurchaseDate?: Timestamp

clients/{id}/purchases/{id}
  items: PurchaseItem[]
  totalAmount, discountAmount, debtIncurred
  paymentMethod, paymentDetails
  purchaseDate: Timestamp
  createdBy: string

clients/{id}/debtPayments/{id}  ← NUEVO
  amount: number
  reason: string
  paymentMethod: string
  appliedToDebt: 'commercial' | 'workshop'
  paidAt: Timestamp
  createdBy: string

clients/{id}/creditAdjustments/{id}
  amount, reason, adjustedBy, adjustedAt

accessories/{id}
  name: string
  category: string (Cables, Cargadores, Cases, Protectores, Audífonos, Otros)
  brand?: string
  costPrice: number
  salePrice: number
  stock: number
  minStock: number (alerta de reorden)
  sku?: string
  isActive: boolean
  updatedAt: Timestamp

sales/{id}  ← NUEVO (colección de ventas completa)
  clientId?: string
  clientSnapshot: { name, phone }
  items: SaleItem[]
  subtotal, discount, total
  paymentMethod: string
  debtIncurred: number
  creditUsed: number
  notes?: string
  status: 'completed' | 'refunded' | 'cancelled'
  createdAt: Timestamp
  createdBy: string (UID)

finance_snapshots/{YYYY-MM}  ← NUEVO (snapshot mensual)
  revenue: number
  cogs: number
  grossProfit: number
  grossMargin: number
  repairRevenue: number
  repairCosts: number
  topModels: { modelo, count, revenue }[]
  topClients: { clientId, name, revenue }[]
  unitsSold: number
  updatedAt: Timestamp
```

### 3.3 Mapa de módulos v2.0

```
App
├── Dashboard          → KPIs en tiempo real (Firestore live queries)
├── Inventario
│   ├── Catálogo       → Grid por lotes (EXISTENTE, mejorar)
│   ├── Lista          → Tabla densa con filtros avanzados (NUEVO)
│   └── Lotes          → Vista de lotes con P&L por lote (NUEVO)
├── Ventas             → POS + historial de ventas (EXISTENTE + MEJORAR)
├── Clientes           → CRM completo (EXISTENTE + COMPLETAR)
├── Taller             → Gestión de reparaciones (EXISTENTE + MEJORAR)
├── Accesorios         → CRUD + stock management (NUEVO)
├── Finanzas           → Reportes P&L (NUEVO)
├── Apartados          → Reservas con expiración (MEJORAR)
└── Configuración      → Usuarios + empresa + lotes
```

---

## 4. PLAN DE IMPLEMENTACIÓN

### Sprint 1 — Finanzas (Semana 1, P0)
**Por qué primero**: Sin datos de rentabilidad, el negocio está ciego.

Archivos a crear:
- `src/features/finance/FinancePage.tsx`
- `src/features/finance/components/RevenueChart.tsx`
- `src/features/finance/components/ProfitSummary.tsx`
- `src/features/finance/components/TopModelsTable.tsx`
- `src/features/finance/components/TopClientsTable.tsx`
- `src/features/finance/hooks/useFinanceData.ts`

Datos calculados (client-side, sin colección nueva inicialmente):
```
revenue = Σ precioVenta de phones con estado=Vendido en rango de fechas
cogs    = Σ (costo + repairCosts) de esos phones
gp      = revenue - cogs
gm%     = (gp / revenue) * 100
```

Filtros: Por rango de fechas, por lote, export CSV

---

### Sprint 2 — Módulo Vendidos (Semana 1, P0)
**Por qué**: Auditoría básica. Sin historial de ventas no hay accountability.

Archivos a crear:
- `src/features/sales/SalesHistoryPage.tsx`
- `src/features/sales/components/SalesList.tsx`
- `src/features/sales/components/SaleDetailModal.tsx`
- `src/features/sales/hooks/useSalesHistory.ts`

Vista: Tabla de ventas por fecha, cliente, monto — con filtros y búsqueda.
Detalle: Modal con items, forma de pago, IMEI de cada unidad.

---

### Sprint 3 — Accesorios (Semana 2, P1)
**Por qué**: Revenue secundario capturado, integración con POS existente.

Archivos a crear:
- `src/features/accessories/AccessoriesPage.tsx`
- `src/features/accessories/components/AccessoryTable.tsx`
- `src/features/accessories/components/AccessoryForm.tsx`
- `src/features/accessories/hooks/useAccessories.ts`

Integración: Accesorios ya se pueden agregar al carrito en SalesStore (type: 'accessory')
Solo falta el CRUD y la colección en Firestore.

---

### Sprint 4 — Completar Clientes (Semana 2, P1)
Gaps actuales:
1. Separar `debtAmount` (comercial) de `workshopDebt` (taller)
2. Historial de pagos de deuda
3. Aging report visual (0-30, 31-60, 60+ días)
4. Vista de compras completa con search

---

### Sprint 5 — Dashboard Real (Semana 3, P1)
Reemplazar datos hardcodeados con live queries:
- KPIs: Stock disponible, ventas hoy, deuda total, crédito total
- Gráfica 30 días de ventas
- Top 5 modelos esta semana
- Top 5 clientes por deuda
- Últimas 10 transacciones (feed de actividad)

---

### Sprint 6 — Mejoras UX (Semana 3-4, P2)
1. **Búsqueda global** (Cmd+K): busca en phones, clientes, accesorios simultáneamente
2. **Vista Lista** en inventario (tabla densa + sorting por columna)
3. **Bulk actions**: seleccionar múltiples → cambiar estado / exportar / reasignar lote
4. **Export CSV** en todos los módulos con datos tabulares
5. **PWA**: service worker para offline-capable

---

## 5. REGLAS FIRESTORE v2 (Necesarias para nuevas colecciones)

```
// Accessories
match /accessories/{id} {
  allow read: if isSignedIn();
  allow write: if isAdmin() || isGerente();
}

// Sales (historial)
match /sales/{id} {
  allow read: if isSignedIn();
  allow create: if isAdmin() || isGerente();
  allow update, delete: if isAdmin(); // Solo admin puede anular
}

// Debt payments
match /clients/{clientId}/debtPayments/{id} {
  allow read: if isSignedIn();
  allow create: if isAdmin() || isGerente();
  allow update, delete: if false; // Inmutable
}
```

---

## 6. KPIs DEL NEGOCIO (para Dashboard)

| KPI | Fórmula | Frecuencia |
|-----|---------|------------|
| GMV (Gross Merchandise Value) | Σ precioVenta vendidos (mes) | Diario |
| Gross Margin | (GMV - COGS) / GMV | Semanal |
| Inventory Turnover | Unidades vendidas / Stock promedio | Mensual |
| Days Sales Outstanding | Deuda total / (GMV/30) | Semanal |
| Accessory Attach Rate | Ventas accesorios / Ventas totales | Mensual |
| Customer LTV (top 10) | Σ compras históricas por cliente | Mensual |
| AOV (Average Order Value) | GMV / # transacciones | Semanal |
| Workshop P&L | Ingresos taller - Costos taller | Mensual |

---

## 7. DEUDA TÉCNICA A RESOLVER (en paralelo)

1. **IMEI uniqueness**: Agregar Cloud Function `onPhoneCreate` que verifica duplicados
2. **Timestamps consistentes**: Migrar fechas string → Firestore Timestamps con script de migración
3. **Índices Firestore**: Crear índices para queries frecuentes (estado + fechaIngreso, lote + estado)
4. **Error Boundaries**: Wrappear cada página con ErrorBoundary para aislar crashes
5. **Tipos estrictos**: Eliminar `unknown` restantes, usar Zod para validar data de Firestore
6. **Tests E2E**: Vitest + Testing Library para flujos críticos (crear venta, pagar deuda)

---

## 8. MÉTRICAS DE ÉXITO

- **Performance**: Lighthouse score ≥ 90 (actualmente ~70 por bundle grande)
- **Correctness**: 0 crashes en producción por 30 días consecutivos
- **Completeness**: Los 10 módulos al 100% en 4 semanas
- **Adoption**: 100% de ventas registradas en sistema (vs. registro manual actual)
