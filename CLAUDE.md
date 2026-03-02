# Top Line Tec — Contexto del Proyecto

## Estrategia de deploy (IMPORTANTE)

Dos apps corriendo en PARALELO durante la transición:

| URL | Estado | Acción |
|-----|--------|--------|
| `salvinews.xyz` | Producción vieja — clientes la usan HOY | **NO TOCAR** |
| `inventario-a6aa3.web.app` | Nueva app — aquí trabajamos | Deploy libre |

Cuando la nueva esté lista al 100%: reapuntar DNS de `salvinews.xyz` → Firebase Hosting `inventario-a6aa3`.
El comando de deploy de la nueva es siempre: `firebase deploy --only hosting`

---

## Stack
- React 19 + TypeScript + Vite
- Firebase 12 (Firestore + Auth + Storage + Hosting)
- TailwindCSS 4
- @tanstack/react-query
- Firebase project: `inventario-a6aa3`

## Roles
`admin` | `gerente` | `vendedor` | `taller` | `comprador`

## Rutas principales
| Ruta | Descripción | Roles |
|------|-------------|-------|
| `/dashboard` | Panel principal | todos |
| `/inventory` | Inventario de teléfonos | admin, gerente, vendedor, comprador |
| `/clients` | Clientes y deudas | admin, gerente, vendedor |
| `/workshop` | Taller | admin, gerente, taller |
| `/receiving` | Recepción con escáner | admin, gerente, comprador |
| `/insights` | BI / Cuellos de botella | admin, gerente |
| `/finance` | Finanzas | admin, gerente |
| `/accessories` | Accesorios | admin, gerente, vendedor |
| `/sales` | Historial de ventas | admin, gerente |
| `/users` | Usuarios | admin |
| `/catalogo` | Catálogo público | público |

## Flujo de estados de teléfono
```
En Bodega (USA) → En Tránsito → En Stock (Disponible) → Apartado → Vendido/Pagado/Entregado
                                       ↓
                              Enviado a Taller → En Taller → En Stock (después de reparar)
```

## Módulo de deuda (implementado Feb 2026)
- `client.debtAmount` — acumulador escalar
- `clients/{id}/debtPayments` — subcollección de pagos (atómico con runTransaction)
- `clients/{id}/debtAdjustments` — subcollección de ajustes manuales
- `useRecordDebtPayment()` — transacción atómica
- `useDebtHistory()` — historial unificado pagos + ajustes

## Notas de arquitectura
- Bluetooth barcode scanner = input HID (teclado), siempre mantener focus en el campo
- `fechaIngreso` y `fechaVenta` son strings ISO (no Firestore Timestamps) en teléfonos
- `paidAt` / `adjustedAt` SÍ son serverTimestamp (Firestore Timestamp)
- El costo (`phone.costo`) es solo precio de compra, NO landed cost — no calcular margen bruto
