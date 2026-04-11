---
name: Cost Permissions System — Design and Test Results
description: How cost/margin visibility works and what was tested on 2026-04-10
type: project
---

## Cost Permissions — Design and Test Results (2026-04-10)

### Implementation
- File: `src/lib/permissions.ts`
- `COST_VIEWER_EMAILS = ['administration@toplintecinc.com']`
- `canViewCosts(email)` — returns true ONLY for that exact email
- Used in: PhoneTable, PhoneDetailsModal, AccessoriesPage, FinancePage, DashboardPage, ScannerView, ManualForm

### Gate Logic by Component

| Component | Gate 1 (role) | Gate 2 (email) | Behavior |
|-----------|---------------|----------------|----------|
| PhoneTable | none | `showCosts=canViewCosts(email)` | COSTO column hidden unless administration@ |
| PhoneDetailsModal | `canSeeCost=['admin','gerente']` | `showCosts` inside | Financial section shown to admin+gerente, but Costo/Margen only to administration@ |
| AccessoriesPage | none | `showCosts` | Costo+Margen columns hidden unless administration@ |
| FinancePage | route: admin+gerente | `canViewCosts(email)` at page level | Entire page blocked for non-administration@ emails |
| DashboardPage | CRASHED | — | Cannot test (BUG-001) |

### Test Results vs Expected

| User | Email | Role | Inventory COSTO col | Details Costo/Margen | Finance page |
|------|-------|------|---------------------|----------------------|--------------|
| gerencia1 | gerencia1@toplinetec.com | gerente | HIDDEN (PASS) | HIDDEN, only PrecioVenta (PASS) | Acceso restringido (PASS) |
| danielabrego95 | danielabrego95@gmail.com | admin | HIDDEN (PASS — correct, not administration@) | HIDDEN, only PrecioVenta (PASS) | Acceso restringido (PASS) |
| administration | administration@toplintecinc.com | — | NOT TESTED (login creds unknown) | NOT TESTED | NOT TESTED |

### Known Design Ambiguity
PhoneDetailsModal shows "Información Financiera" section header to admin+gerente (role gate)
but only shows Precio de Venta inside (no Costo or Margen). This may confuse gerente users
who see the section but get no cost data. Consider hiding the section entirely if !showCosts.

### buyer1 Test — BLOCKED
`buyer1@toplintecinc.com / Yughio123` — credentials invalid in Firebase Auth.
Cannot test comprador role. Login silently fails (toast fires but test didn't capture it).
