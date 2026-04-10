# Demo Iveth — Plan de Preparacion

> Fecha: 2026-03-31
> Objetivo: Clonar TopLine Tec con branding de Iveth para demo funcional
> NO deployar hasta que Daniel confirme

---

## 1. Archivos que necesitan cambios de branding

### Frontend (src/)

| Archivo | Linea(s) | Texto actual | Cambiar a |
|---------|----------|-------------|-----------|
| `index.html` | 5 | `href="/logo-topline.png"` | Logo nuevo |
| `index.html` | 7 | `Top Line Tec — Sistema de Gestion` | Nombre Iveth |
| `src/features/auth/LoginPage.tsx` | 78 | `Top Line Tec` (h1 titulo) | Nombre Iveth |
| `src/features/auth/LoginPage.tsx` | 79 | `Sistema de Gestion Mayorista` | Subtitulo Iveth |
| `src/features/auth/LoginPage.tsx` | 152 | `Top Line Tec. Todos los derechos reservados.` | Footer Iveth |
| `src/features/dashboard/DashboardPage.tsx` | 80 | `Top Line Tec` (header h1) | Nombre Iveth |
| `src/features/dashboard/DashboardPage.tsx` | 81 | `Sistema de Gestion Mayorista` | Subtitulo Iveth |
| `src/features/public/components/PublicLayout.tsx` | 16 | `TopLine Store` (header catalogo publico) | Store Iveth |
| `src/features/public/components/PublicLayout.tsx` | 27 | `TopLine Tec. Precios sujetos a cambio...` | Footer Iveth |
| `src/features/public/components/CheckoutModal.tsx` | 98 | `*Nuevo pedido Top Line Tec — Transferencia bancaria*` | WA msg Iveth |
| `src/features/public/pages/CheckoutSuccessPage.tsx` | 28 | `El equipo de Top Line Tec` | Nombre Iveth |
| `src/features/public/pages/MyOrdersPage.tsx` | 30-32 | `Top Line Tec` (comentario) + `TOPLINE_WA_NUMBER` + fallback `17866593427` | WA Iveth |
| `src/features/inventory/pages/LoteClientViewPage.tsx` | 139 | `Top Line Tec · Vista Cliente` | Nombre Iveth |
| `src/features/inventory/pages/LoteClientViewPage.tsx` | 340 | `Top Line Tec · Precios sujetos a cambio...` | Footer Iveth |
| `src/utils/whatsappUtils.ts` | 16,58,69,85,92 | `Top Line Tec` (x5 en mensajes WA) + `Miami, FL` | Nombre + ubicacion Iveth |
| `src/services/pdf/generateInvoicePDF.ts` | 4, 99, 105 | `Top Line Tec` / `TOP LINE TEC` + `Miami, FL, USA` | Nombre + ubicacion Iveth |

### Cloud Functions (functions/src/)

| Archivo | Linea(s) | Texto actual |
|---------|----------|-------------|
| `functions/src/email/sender.ts` | 13 | `Top Line Tec <noreply@toplinetec.com>` |
| `functions/src/email/sender.ts` | 45 | `Tu acta de venta Top Line Tec` |
| `functions/src/email/sender.ts` | 71 | `— Top Line Tec` |
| `functions/src/email/template.ts` | 2, 45, 98 | `Top Line Tec` (titulo email HTML) |
| `functions/src/fritz/systemPrompt.ts` | 24 | `Sos Fritz, el asistente de Top Line Tec` |
| `functions/src/index.ts` | 422 | `TopLine${Math.floor(...)}` (password temporal) |
| `functions/src/index.ts` | 491 | `Gracias por comprar con Top Line Tec` |
| `functions/src/index.ts` | 634, 712 | `sistema@toplinetec.com` |

### Assets estaticos (public/)

| Archivo | Descripcion |
|---------|-------------|
| `public/logo-topline.png` | Favicon/logo — reemplazar con logo Iveth |
| `public/guia-eduardo.html` | Manual de Eduardo — NO incluir en demo Iveth |

### Archivos de config

| Archivo | Cambio |
|---------|--------|
| `.firebaserc` | Nuevo project ID de Firebase |
| `tailwind.config.js` | Colores primarios (actualmente azul sky — considerar cambio) |

### NO tocar (solo comentarios internos con "Eduardo")

Estos archivos mencionan "Eduardo" solo en comentarios de codigo para desarrolladores. No se muestran al usuario:
- `src/lib/phoneUtils.ts` — comentarios sobre codigos de proveedor
- `src/features/receiving/hooks/useReceivingSession.ts` — comentario IMEI parcial
- `src/features/inventory/services/batchService.ts` — comentario
- `src/features/inventory/components/ScannerView.tsx` — comentario warning
- `src/features/inventory/components/ManualForm.tsx` — comentario
- `src/features/suppliers/hooks/useSupplierStats.ts` — comentario
- `src/features/suppliers/components/AddSupplierModal.tsx` — texto UI "Eduardo" (CAMBIAR: linea 101)
- `src/features/import-shipments/ImportShipmentsPage.tsx` — texto UI "Eduardo" (CAMBIAR: linea 189)
- `src/features/dashboard/hooks/useDashboardStats.ts` — comentarios
- `src/features/phone-portal/hooks/usePhoneByImei.ts` — comentario

**UI-visible "Eduardo" references que SI hay que cambiar:**
- `src/features/suppliers/components/AddSupplierModal.tsx:101` — "que Eduardo usa en el campo marca"
- `src/features/import-shipments/ImportShipmentsPage.tsx:189` — "cuando Eduardo mande telefonos"

---

## 2. Variables de entorno necesarias

Crear `.env.iveth`:
```env
# Firebase — Proyecto nuevo de Iveth
VITE_FIREBASE_API_KEY=<nuevo>
VITE_FIREBASE_AUTH_DOMAIN=<nuevo>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<nuevo>
VITE_FIREBASE_STORAGE_BUCKET=<nuevo>.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=<nuevo>
VITE_FIREBASE_APP_ID=<nuevo>

# WhatsApp de Iveth (reemplaza el de Eduardo)
VITE_TOPLINE_WA_NUMBER=<numero_iveth_sin_guiones>
```

---

## 3. Pasos para crear el demo

### 3a. Crear proyecto Firebase
```bash
firebase projects:create iveth-celulares --display-name "Iveth Celulares"
firebase projects:list  # verificar que se creo
```

Luego en Firebase Console:
1. Habilitar Authentication > Email/Password
2. Crear Firestore Database (region us-central1)
3. Habilitar Storage
4. Copiar config de Project Settings > General > Your apps > Web app

### 3b. Preparar branding

**Enfoque rapido** (la app NO tiene un config centralizado de branding — todo esta hardcoded):

Opcion A — **Find & Replace directo** (~18 archivos frontend, ~5 archivos functions):
- Buscar "Top Line Tec" → "Iveth Celulares" (o el nombre que ella quiera)
- Buscar "TopLine Store" → "Iveth Store"
- Buscar "TopLine Tec" → "Iveth Celulares"
- Buscar "TOP LINE TEC" → nombre en mayusculas
- Buscar "Miami, FL" → "San Salvador" (o donde sea)
- Buscar "Eduardo" en strings UI visibles (2 archivos)
- Reemplazar logo-topline.png con un logo generico o de Iveth

Opcion B — **Crear constante centralizada** (mejor para futuro multi-tenant):
```ts
// src/lib/brandConfig.ts
export const BRAND = {
  name: 'Iveth Celulares',
  storeName: 'Iveth Store',
  tagline: 'Compra-Venta de Celulares',
  location: 'San Salvador, El Salvador',
  whatsapp: '50312345678',
  email: 'sistema@ivethcelulares.com',
};
```
Luego reemplazar todos los hardcodes con `BRAND.name`, etc.

**Recomendacion: Opcion A para la demo, Opcion B si Iveth se convierte en cliente.**

### 3c. Build y deploy
```bash
# Copiar env
cp .env.iveth .env.local

# Build
npm run build

# Deploy (Daniel lo hace)
firebase use iveth-celulares
firebase deploy --only hosting
firebase deploy --only firestore:rules
firebase deploy --only storage
firebase deploy --only functions  # si Fritz/emails se necesitan
```

### 3d. Crear usuario admin
En Firebase Console > Authentication > Add User:
- Email: iveth@demo.com (o el email real de ella)
- Password: Demo2026!

Luego en Firestore > Collection `users` > Add document:
```json
{
  "email": "iveth@demo.com",
  "displayName": "Iveth",
  "role": "admin",
  "createdAt": "<timestamp>"
}
```

### 3e. Seed demo data

Usar Firebase Console o un script para crear documentos en collection `phones`.

---

## 4. Demo data — Telefonos realistas para mercado salvadoreno

### Proveedores (collection: suppliers)

| Codigo | Nombre | Tipo |
|--------|--------|------|
| MIA | Proveedor Miami | Internacional |
| LOCAL | Compra Local | Local |
| TRADE | Trade-in Clientes | Trade-in |

### Telefonos (collection: phones) — 20 unidades

| # | marca | modelo | almacenamiento | condicion | precioVenta | costo | estado | proveedor | IMEI (ficticio) |
|---|-------|--------|----------------|-----------|-------------|-------|--------|-----------|-----------------|
| 1 | Apple | iPhone 15 Pro Max | 256GB | Grade A | $799 | $550 | En Stock | MIA | 353456789012345 |
| 2 | Apple | iPhone 15 Pro | 128GB | Grade A | $699 | $480 | En Stock | MIA | 353456789012346 |
| 3 | Apple | iPhone 14 Pro | 128GB | Grade B | $549 | $380 | En Stock | MIA | 353456789012347 |
| 4 | Apple | iPhone 14 | 128GB | Grade A | $449 | $310 | En Stock | MIA | 353456789012348 |
| 5 | Apple | iPhone 13 | 128GB | Grade B | $349 | $240 | En Stock | LOCAL | 353456789012349 |
| 6 | Apple | iPhone 12 | 64GB | Grade C | $199 | $130 | En Stock | TRADE | 353456789012350 |
| 7 | Samsung | Galaxy S24 Ultra | 256GB | Nuevo (sellado) | $749 | $580 | En Stock | MIA | 354567890123451 |
| 8 | Samsung | Galaxy S24 | 128GB | Grade A | $499 | $340 | En Stock | MIA | 354567890123452 |
| 9 | Samsung | Galaxy A54 | 128GB | Nuevo | $249 | $170 | En Stock | MIA | 354567890123453 |
| 10 | Samsung | Galaxy A34 | 128GB | Grade A | $179 | $120 | En Stock | LOCAL | 354567890123454 |
| 11 | Samsung | Galaxy A15 | 128GB | Nuevo | $129 | $85 | En Stock | MIA | 354567890123455 |
| 12 | Xiaomi | Redmi Note 13 Pro | 256GB | Nuevo | $219 | $150 | En Stock | MIA | 355678901234561 |
| 13 | Xiaomi | Redmi 13C | 128GB | Nuevo | $99 | $65 | En Stock | MIA | 355678901234562 |
| 14 | Xiaomi | Poco X6 Pro | 256GB | Nuevo | $269 | $185 | En Stock | MIA | 355678901234563 |
| 15 | Motorola | Moto G84 | 256GB | Nuevo | $199 | $135 | En Stock | MIA | 356789012345671 |
| 16 | Motorola | Moto G54 | 128GB | Grade A | $149 | $100 | En Stock | LOCAL | 356789012345672 |
| 17 | Apple | iPhone 15 | 128GB | Grade A | $599 | $420 | Apartado | MIA | 353456789012351 |
| 18 | Samsung | Galaxy S23 Ultra | 256GB | Grade B | $549 | $380 | Apartado | MIA | 354567890123456 |
| 19 | Apple | iPhone 13 Pro | 128GB | Grade A | $399 | $280 | Vendido | TRADE | 353456789012352 |
| 20 | Samsung | Galaxy A54 | 128GB | Grade A | $229 | $155 | Vendido | LOCAL | 354567890123457 |

### Clientes con deudas (collection: clients)

| Nombre | Telefono | debtAmount | Nota |
|--------|----------|------------|------|
| Carlos Menjivar | 50378901234 | $150 | Debe saldo de iPhone 13 (abono parcial) |
| Maria Elena Rivas | 50376543210 | $299 | Apartado S23 Ultra, primer abono pendiente |
| Jose Luis Hernandez | 50371234567 | $0 | Cliente frecuente, sin deuda (buen historial) |

### Ventas recientes (para que el dashboard muestre datos)

| Telefono | Cliente | Precio | Fecha |
|----------|---------|--------|-------|
| iPhone 13 Pro 128GB | Carlos Menjivar | $399 | 2026-03-25 |
| Galaxy A54 128GB | Jose Luis Hernandez | $229 | 2026-03-28 |

---

## 5. Guion del demo (orden de "wow factor")

### Acto 1: El catalogo publico (la arma secreta)
1. Abrir `/catalogo` en el celular de Iveth
2. Mostrar los telefonos con fotos, filtros por marca, condicion
3. "Esto lo podes compartir por Instagram, WhatsApp, o poner el link en tu bio"
4. Mostrar que un cliente puede apartar un telefono desde ahi
5. **Punch line**: "Tus clientes ven tu inventario en tiempo real. Si vendes algo, desaparece al instante."

### Acto 2: Escanear IMEI
1. Loguearse como admin
2. Ir a Inventario > buscar por IMEI
3. Mostrar toda la info: modelo, precio, condicion, proveedor, historial
4. "Con esto sabes exactamente que tenes, de donde vino, y cuanto pagaste"

### Acto 3: Hacer una venta
1. Seleccionar un telefono En Stock
2. Registrar venta a un cliente
3. Mostrar que genera factura PDF automaticamente
4. Mostrar el mensaje de WhatsApp pre-armado para enviarle al cliente
5. **Punch line**: "En 30 segundos registras la venta, generas factura, y le mandas al cliente por WhatsApp"

### Acto 4: Control de deudas
1. Ir a Clientes
2. Mostrar Carlos Menjivar con $150 de deuda
3. Registrar un abono de $50
4. Mostrar que el saldo se actualiza al instante
5. "Ya no necesitas cuaderno. Cada abono queda registrado con fecha y hora."

### Acto 5: Reportes de ganancias
1. Ir a Dashboard
2. Mostrar ventas del mes, ingresos, telefonos en stock
3. Ir a Finanzas para ver detalles
4. **Punch line**: "Sabes exactamente cuanto ganaste este mes, sin Excel, sin calculadora"

### Cierre
- "Todo esto funciona desde tu celular. No necesitas computadora."
- "Tu catalogo se actualiza solo. Tus clientes compran solos."
- "Y si necesitas ayuda, Fritz (el asistente AI) esta integrado."

---

## 6. Evaluacion de branding: enfoque mas rapido

**Estado actual**: El nombre "Top Line Tec" esta hardcoded en ~18 archivos del frontend y ~5 archivos de Cloud Functions. NO existe un config centralizado de branding.

**Camino mas rapido para la demo**:
1. Find & replace en los ~18 archivos frontend (30 min)
2. Reemplazar logo-topline.png con un placeholder generico
3. Cambiar colores primarios en tailwind.config.js (5 min, opcional)
4. NO tocar Cloud Functions para la demo (Fritz, emails no son criticos para impresionar)

**Total estimado**: 1-2 horas incluyendo Firebase setup + seed data.

**Post-demo si Iveth dice si**: Crear `brandConfig.ts` centralizado y refactorizar para multi-tenant limpio.
