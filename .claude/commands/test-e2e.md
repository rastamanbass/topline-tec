# /test-e2e — End-to-End Testing con Playwright

Eres un QA automation engineer que diseña y ejecuta tests E2E con Playwright para Top Line Tec.

## CONTEXTO
```
Ruta: /Users/danielabrego/Projects/topline-tec/
App: https://inventario-a6aa3.web.app (producción)
Local: npm run dev → http://localhost:5173
Stack: React 19 + Firebase + Playwright 1.58
Roles: admin | gerente | vendedor | comprador | taller
```

## SETUP (si no existe playwright.config.ts)

Crear `playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
  },
});
```

Crear `e2e/helpers/auth.ts` con login helpers para cada rol.

## USER JOURNEYS CRÍTICOS (Prioridad)

### Journey 1: POS Sale (Marta/gerente) — CRITICAL
```
1. Login como gerente
2. Ir a /inventory
3. Escanear IMEI en ScanToSell → teléfono se agrega al carrito
4. Se abre PaymentModal automáticamente
5. Seleccionar cliente
6. Seleccionar método de pago (efectivo)
7. Confirmar venta
8. Verificar: teléfono estado = "Vendido", purchase record creado
```

### Journey 2: B2B Purchase (comprador) — CRITICAL
```
1. Login como comprador
2. Ir a /store o /catalogo
3. Reservar 2 teléfonos
4. Verificar FloatingCart aparece con countdown
5. Ir a checkout
6. Seleccionar "Transferencia"
7. Verificar: order creada con status "pending_transfer"
8. Verificar: teléfonos en estado "Apartado"
```

### Journey 3: Client Debt Payment — HIGH
```
1. Login como gerente
2. Ir a /clients
3. Seleccionar cliente con deuda
4. Click "Registrar Pago"
5. Ingresar monto parcial
6. Confirmar → verificar debtAmount decrementó
7. Verificar historial de pagos muestra el nuevo pago
```

### Journey 4: Receiving with Scanner — HIGH
```
1. Login como comprador
2. Ir a /recepcion
3. Escanear IMEI (input simula barcode gun)
4. Verificar auto-detección de marca/modelo
5. Completar formulario manual
6. Guardar → verificar teléfono creado en inventario
```

### Journey 5: Workshop Flow — MEDIUM
```
1. Login como admin
2. Ir a /inventory → seleccionar teléfono "En Stock"
3. Cambiar estado a "Enviado a Taller"
4. Login como taller
5. Ir a /taller → ver teléfono
6. Agregar reparación con costo
7. Marcar como completado → estado vuelve a "En Stock"
```

### Journey 6: Auth & Permissions — CRITICAL
```
1. Login como vendedor
2. Intentar navegar a /admin/usuarios → redirect a /dashboard
3. Intentar navegar a /finanzas → redirect
4. Verificar: vendedor SÍ puede acceder a /inventory, /clients, /accesorios
5. Login como comprador → redirect a /store
```

### Journey 7: Mobile Responsiveness — MEDIUM
```
1. Viewport iPhone 14 (390x844)
2. Login → verificar BottomNav visible
3. /inventory → verificar tabla scrollable o vista catálogo
4. Abrir PaymentModal → verificar no se corta
5. /catalogo → verificar cards stack vertical
```

## PROTOCOLO DE EJECUCIÓN

### Fase 1: Setup
- Verificar playwright instalado: `npx playwright --version`
- Crear config si no existe
- Crear helpers de auth
- Instalar browsers: `npx playwright install chromium`

### Fase 2: Escribir tests
- Un archivo por journey: `e2e/pos-sale.spec.ts`, `e2e/b2b-purchase.spec.ts`, etc.
- Usar page objects si hay más de 3 journeys
- Usar `test.describe.serial()` para journeys que dependen de estado

### Fase 3: Ejecutar
```bash
npx playwright test --reporter=html 2>&1
```

### Fase 4: Reporte
```
## E2E Test Report
- Journeys testeados: N/7
- Pass: N | Fail: N
- Screenshots de fallos: [lista]
- Tiempo total: Xs
- Dispositivos: Desktop Chrome + iPhone 14
```

## REGLAS
1. **Nunca usar selectores frágiles** — preferir `data-testid`, `role`, `aria-label`
2. **Esperar elementos** — `await page.waitForSelector()` antes de interactuar
3. **No hacer sleep** — usar `waitForResponse`, `waitForSelector`, `waitForURL`
4. **Limpiar estado** — cada test debe poder correr independientemente
5. **Screenshots en fallo** — configurado automáticamente
6. **No testear contra producción** — siempre contra `localhost:5173` con dev server
