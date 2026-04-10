# CeluStock — Demo Funcional para Iveth

## Resumen

Fork de TopLine Tec rebrandeado como "CeluStock" para Iveth, vendedora mayorista de telefonos en El Salvador. Demo funcional desplegado en Firebase, con onboarding tutorial integrado. Iveth entra sola, el tutorial la guia, mete sus telefonos, y el sistema funciona completo.

## Cliente

- **Nombre**: Iveth
- **Tel**: +503 7579 0896
- **Negocio**: Venta de telefonos usados y nuevos, multiples vendedores, vende por redes sociales
- **Inventario**: Miles de dolares en telefonos
- **Sistema actual**: Ninguno
- **Compra de**: Multiples proveedores (mayorista)

## Decisiones de diseno

| Aspecto | Decision |
|---------|----------|
| Nombre | CeluStock |
| Enfoque | Fork completo de TopLine a nuevo repo |
| Ruta local | `~/Projects/celustock/` |
| Firebase project | `celustock-app` |
| Hosting URL | celustock-app.web.app |
| Branding | Estilo Apple: blanco, grises, azul accent, Inter font |
| WhatsApp | +503 7579 0896 (Iveth) |
| Features activas | 15 de 18 |
| Features ocultas | Cotizador, Fritz, Import Shipments |
| Datos iniciales | Vacio. Iveth mete todo. TAC DB precargada para auto-detectar |
| Demo strategy | Le mandamos link, entra sola, tutorial la guia |

## Paleta Apple

```
Fondo principal:     #ffffff
Fondo secundario:    #f5f5f7
Texto principal:     #1d1d1f
Texto secundario:    #6e6e73
Texto terciario:     #86868b
Accent/CTA:          #0071e3
Success:             #30d158
Warning:             #ff9f0a
Error:               #ff3b30
Bordes:              #e8e8ed
```

Tipografia: Inter. Border-radius grandes (12-16px). Botones pildora (980px). Shadows sutiles. Mucho espacio blanco. Sin gradientes, sin neon.

## Features activadas

1. **Inicio** (Dashboard) — KPIs, ganancias, stock
2. **Inventario** — Lista IMEI, fotos, estados, scanner camara
3. **Ventas** — POS scanner, pagos mixtos
4. **Clientes** — Compradores, deudas, historial abonos
5. **Catalogo** — Link publico para redes sociales con WhatsApp
6. **Proveedores** — De quien compro cada lote
7. **Facturas de compra** — Import Excel de lotes
8. **Taller** — Telefonos mandados a reparar a otro taller
9. **Finanzas** — P&L, margenes, deudores
10. **Etiquetas** — Stickers con codigo de barras
11. **Portal IMEI** — Vista detallada por IMEI con timeline
12. **Analisis** — BI: modelos que se mueven, stock estancado
13. **Recepcion** — Recepcion de lotes con scanner
14. **Pedidos** — Pedidos de clientes B2B
15. **Usuarios** — Gestion de vendedores con roles

## Features desactivadas

- **Cotizador**: Ocultar ruta en App.tsx + item en sidebar
- **Fritz**: Ocultar ruta + sidebar item + floating button
- **Import Shipments**: Ocultar ruta + sidebar item

Metodo: solo ocultar, no borrar codigo. Comentar las rutas y sidebar items.

## Onboarding Tutorial

Componente `<OnboardingOverlay>` que se renderiza sobre la UI real.

### Flujo:

1. **Welcome modal** al primer login:
   - "Bienvenida a CeluStock"
   - "Vamos a registrar tu primer telefono. Toma 30 segundos."
   - [Boton: Empezar]

2. **Tooltips pulsantes** sobre botones reales del sidebar:
   - Inventario: "Aca ves todos tus telefonos"
   - Ventas: "Aca vendes y cobras"
   - Clientes: "Aca ves quien te debe"
   - Catalogo: "Este link lo compartis en redes"

3. **Guia en formulario de agregar telefono:**
   - Badge pulsante en boton "Agregar telefono": "Empieza aca"
   - Tooltip en IMEI: "Escanea el codigo o escribi los 15 numeros"
   - Tooltip en foto: "Tomale foto con tu celular — sale en el catalogo"
   - Tooltip en costo: "Cuanto te costo a vos"
   - Tooltip en precio: "A cuanto lo queres vender"

4. **Post primer telefono:**
   - "Tu catalogo ya tiene 1 telefono."
   - "Copia este link y compartilo en tus redes:"
   - [URL del catalogo]
   - [Boton: Copiar link]
   - [Boton: Compartir por WhatsApp]

### Implementacion:

- Flag Firestore: `users/{uid}.onboardingCompleted: boolean`
- Componente wrapper que chequea el flag
- Se desactiva cuando `onboardingCompleted: true`
- Boton "Saltar tutorial" siempre visible
- CSS: overlay semi-transparente, tooltips con flecha, animacion pulse

## Archivos a modificar (branding)

Basado en grep de "Top Line" en src/:

1. `index.html` — title
2. `src/features/auth/LoginPage.tsx` — h1 + footer (2 refs)
3. `src/features/dashboard/DashboardPage.tsx` — h1 (1 ref)
4. `src/features/public/components/PublicLayout.tsx` — h1 + footer (2 refs)
5. `src/features/public/components/CheckoutModal.tsx` — WhatsApp message (1 ref)
6. `src/features/public/pages/MyOrdersPage.tsx` — comment (1 ref)
7. `src/features/public/pages/CheckoutSuccessPage.tsx` — texto (1 ref)
8. `src/features/inventory/pages/LoteClientViewPage.tsx` — header + footer (2 refs)
9. `src/utils/whatsappUtils.ts` — mensajes WhatsApp (5 refs)
10. `src/services/pdf/generateInvoicePDF.ts` — header PDF (1 ref)
11. `tailwind.config.js` — paleta de colores
12. `.env` — Firebase config + WhatsApp number
13. `.firebaserc` — project alias
14. `firebase.json` — no cambia (estructura igual)
15. `public/manifest.json` o `index.html` — meta tags, favicon

## Archivos a crear

1. `src/components/OnboardingOverlay.tsx` — componente tutorial
2. `src/components/Tooltip.tsx` — tooltip reutilizable con flecha y pulse
3. `src/hooks/useOnboarding.ts` — hook para leer/escribir flag de onboarding

## Archivos a modificar (features)

1. `src/App.tsx` — comentar rutas de cotizador, fritz, import-shipments
2. Sidebar component — ocultar items de cotizador, fritz, import-shipments

## Firebase setup

1. `firebase projects:create celustock-app`
2. Habilitar: Authentication (email/password), Firestore, Storage, Hosting
3. Crear `.env.celustock` con las nuevas credenciales
4. Copiar `firestore.rules` y `storage.rules` (mismas reglas)
5. Deploy: `firebase use celustock && firebase deploy`
6. Crear usuario admin para Iveth en Firebase Console

## Pruebas antes de entregar

1. Login funciona
2. Onboarding tutorial aparece y guia correctamente
3. Registrar telefono con IMEI (scanner + manual)
4. Subir foto desde celular
5. Auto-deteccion de marca/modelo por TAC
6. Vender un telefono
7. Registrar fiado y abono
8. Catalogo publico muestra telefonos con fotos
9. Boton WhatsApp en catalogo abre chat con Iveth
10. Dashboard muestra KPIs
11. Responsive en iPhone (ella usa Apple)
12. Borrar datos de prueba antes de dar acceso

## Esfuerzo estimado

| Tarea | Horas |
|-------|-------|
| Fork + nuevo repo + Firebase project | 0.5h |
| Rebrand 15 archivos | 1h |
| Paleta Apple en tailwind + login + sidebar | 1.5h |
| Onboarding tutorial (3 componentes) | 1.5h |
| Desactivar 3 features | 0.5h |
| Deploy + cuenta Iveth | 0.5h |
| Probar flujo completo en celular | 0.5h |
| **Total** | **6h** |
