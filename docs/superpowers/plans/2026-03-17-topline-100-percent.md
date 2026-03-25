# Top Line Tec — Plan para ponerlo al 100%

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desplegar todo el código pendiente, activar pagos con Stripe, activar emails automáticos con Resend, y preparar la migración de `salvinews.xyz` a la app nueva.

**Architecture:** Firebase project `inventario-a6aa3` con hosting (React SPA), Cloud Functions (Node 20), Firestore, Auth, y Storage. El frontend ya usa Stripe + transferencia bancaria. Solo falta conectar los secrets y desplegar.

**Tech Stack:** React 19 + TypeScript + Vite, Firebase 12, Stripe, Resend (email)

---

## Qué necesita Eduardo ANTES de empezar

Eduardo tiene que crear 3 cuentas y darte las claves:

### 1. Stripe (pagos con tarjeta)
- Ir a [dashboard.stripe.com](https://dashboard.stripe.com) → crear cuenta
- Verificar negocio (nombre, dirección, banco)
- En **Developers → API Keys** copiar:
  - `Publishable key` (empieza con `pk_live_...`)
  - `Secret key` (empieza con `sk_live_...`)
- En **Developers → Webhooks** → agregar endpoint:
  - URL: `https://us-central1-inventario-a6aa3.cloudfunctions.net/stripeWebhook`
  - Eventos: `checkout.session.completed`
  - Copiar el `Webhook signing secret` (empieza con `whsec_...`)

**Total: 3 claves de Stripe**

### 2. Resend (emails automáticos)
- Ir a [resend.com](https://resend.com) → crear cuenta gratis (3,000 emails/mes)
- En **API Keys** → crear key, copiar (empieza con `re_...`)
- En **Domains** → agregar `toplinetec.com`
- Resend te da 3 registros DNS (SPF, DKIM, DMARC) que Eduardo tiene que agregar donde compró el dominio

**Total: 1 clave de Resend + 3 registros DNS**

### 3. Limpiar datos de prueba (2 min)
- Entrar como admin en `inventario-a6aa3.web.app`
- Inventario → buscar "TEST" → borrar los 3 teléfonos de prueba
- Taller → Apple 12 64gb (IMEI 4499) → borrar la nota "Prueba de diagnóstico"

---

## Fase 1: Deploy inmediato (sin depender de Eduardo)

> Esto despliega todo lo que ya funciona. No necesita claves.

### Task 1: Build + Deploy Hosting

**Files:**
- No se modifica código, solo se compila y despliega

- [ ] **Step 1: Build del frontend**

```bash
cd /Users/danielabrego/Projects/topline-tec
npm run build
```

Esperado: `dist/` se regenera con los fixes de IMEI scanner, taller, etc.

- [ ] **Step 2: Deploy hosting**

```bash
firebase deploy --only hosting --project inventario-a6aa3
```

Esperado: `inventario-a6aa3.web.app` refleja todos los cambios.

- [ ] **Step 3: Verificar**

Abrir `https://inventario-a6aa3.web.app`, login como admin, confirmar que todo carga.

---

### Task 2: Fix Node version + Deploy funciones sin secrets

**Files:**
- Modify: `firebase.json` (cambiar `nodejs20` → `nodejs22`)
- Modify: `functions/src/index.ts` (quitar PayPal)

- [ ] **Step 1: Corregir versión de Node**

En `firebase.json`, cambiar:
```json
"runtime": "nodejs20"
```
por:
```json
"runtime": "nodejs22"
```

Esto hace match con `functions/package.json` que dice `"node": "22"`.

- [ ] **Step 2: Quitar código de PayPal**

En `functions/src/index.ts`:
- Borrar función `getPayPalBaseUrl()` (línea ~19)
- Borrar función `getPayPalAccessToken()` (línea ~26)
- Borrar función `createPayPalOrder` (línea ~266)
- Borrar función `capturePayPalOrder` (línea ~347)

Estas funciones nunca se llaman desde el frontend (CheckoutModal solo usa Stripe + Transfer).

- [ ] **Step 3: Quitar PayPal del .env y frontend**

En `.env`, borrar la línea:
```
VITE_PAYPAL_CLIENT_ID=YOUR_PAYPAL_CLIENT_ID_HERE
```

Buscar en `src/` cualquier referencia a PayPal y eliminar imports/código muerto.

- [ ] **Step 4: Compilar funciones**

```bash
cd /Users/danielabrego/Projects/topline-tec/functions
npm run build
```

Esperado: `functions/lib/index.js` se genera sin errores.

- [ ] **Step 5: Deploy funciones que NO necesitan secrets**

```bash
cd /Users/danielabrego/Projects/topline-tec
firebase deploy --only functions:confirmTransferPayment,functions:createUserAccount,functions:lookupTac --project inventario-a6aa3
```

Estas 3 funciones no necesitan claves externas:
- `confirmTransferPayment` — admin confirma transferencia bancaria
- `createUserAccount` — admin crea usuarios
- `lookupTac` — búsqueda de modelo por IMEI (ya existía)

- [ ] **Step 6: Commit**

```bash
git add firebase.json functions/ .env
git commit -m "fix: remove PayPal, fix Node 22, deploy functions without secrets"
```

---

## Fase 2: Activar Stripe (cuando Eduardo dé las claves)

> Eduardo te pasa: `sk_live_...`, `pk_live_...`, `whsec_...`

### Task 3: Configurar Stripe secrets

- [ ] **Step 1: Guardar secrets en Firebase**

```bash
# Secret key (para Cloud Functions)
firebase functions:secrets:set STRIPE_SECRET_KEY --project inventario-a6aa3
# Pegar: sk_live_XXXX

# Webhook secret (para verificar pagos)
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project inventario-a6aa3
# Pegar: whsec_XXXX
```

- [ ] **Step 2: Actualizar publishable key en .env**

En `.env`, cambiar:
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_KEY_HERE
```
por:
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_XXXX
```

- [ ] **Step 3: Rebuild + Deploy**

```bash
npm run build
firebase deploy --only hosting,functions:createStripeCheckout,functions:stripeWebhook --project inventario-a6aa3
```

- [ ] **Step 4: Test de pago**

1. Ir al catálogo público → seleccionar un teléfono → "Pagar con Tarjeta"
2. Stripe redirige a checkout → pagar con tarjeta de prueba `4242 4242 4242 4242`
3. Verificar que el pedido aparece en Firestore `pendingOrders` con `status: paid`

- [ ] **Step 5: Commit**

```bash
git add .env
git commit -m "feat: activate Stripe live payments"
```

---

## Fase 3: Activar Emails (cuando Eduardo dé la clave de Resend + DNS)

> Eduardo te pasa: `re_...` y confirma que agregó los registros DNS

### Task 4: Configurar Resend

- [ ] **Step 1: Guardar secret**

```bash
firebase functions:secrets:set RESEND_API_KEY --project inventario-a6aa3
# Pegar: re_XXXX
```

- [ ] **Step 2: Deploy funciones de email**

```bash
firebase deploy --only functions:onOrderPaid,functions:onInvoiceCreated,functions:onShipmentStatusChanged --project inventario-a6aa3
```

Esto activa:
- Email automático cuando un pedido se paga
- Email automático cuando se crea una factura
- Email automático cuando cambia el estado de un envío

- [ ] **Step 3: Test de email**

1. Crear una factura de prueba desde el módulo Ventas
2. Verificar que llega email a la dirección del cliente
3. Verificar que el email viene de `noreply@toplinetec.com` (no spam)

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: activate Resend email notifications"
```

---

## Fase 4: Migración DNS (cuando TODO esté probado y estable)

> Esta es la última fase. Después de esto, `salvinews.xyz` apunta a la app nueva.

### Task 5: Reapuntar DNS

- [ ] **Step 1: Agregar dominio en Firebase Hosting**

```bash
firebase hosting:channel:deploy live --project inventario-a6aa3
```

O desde Firebase Console → Hosting → Add custom domain → `salvinews.xyz`

Firebase te da 2 registros DNS (A records o CNAME).

- [ ] **Step 2: Eduardo cambia DNS**

Donde compró `salvinews.xyz`, reemplazar los DNS actuales (freehosting.com) por los que Firebase le da.

- [ ] **Step 3: Esperar propagación**

DNS tarda 1-48 horas. Durante ese tiempo ambas apps siguen funcionando.

- [ ] **Step 4: Verificar**

- `salvinews.xyz` → debe cargar la app nueva (React)
- HTTPS debe funcionar (Firebase lo da gratis con Let's Encrypt)

- [ ] **Step 5: Celebrar**

La app vieja queda desactivada. Todo corre en Firebase.

---

## Resumen visual

```
AHORA (sin Eduardo)          CON CLAVES DE EDUARDO         FINAL
─────────────────────         ──────────────────────         ──────
[Fase 1]                      [Fase 2]                      [Fase 4]
 Build + Deploy hosting        Stripe secrets                DNS migration
 Fix Node 22                   Rebuild + deploy              salvinews.xyz → Firebase
 Quitar PayPal                 Test de pago
 Deploy 3 funciones
                               [Fase 3]
                               Resend secret + DNS
                               Deploy email functions
                               Test de email
```

## Dependencias entre fases

| Fase | Depende de | Bloqueado por Eduardo? |
|------|------------|----------------------|
| 1    | Nada       | NO — hacerlo ya      |
| 2    | Fase 1 + claves Stripe | SI |
| 3    | Fase 1 + clave Resend + DNS | SI |
| 4    | Fases 1-3 completas y probadas | SI (cambio DNS) |
