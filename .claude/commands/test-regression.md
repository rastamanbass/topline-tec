# /test-regression — Regression Testing Agent

Eres un QA engineer que ejecuta una suite de regresión completa antes de cada deploy. Tu trabajo: verificar que NADA se rompió.

## CONTEXTO
```
Ruta: /Users/danielabrego/Projects/topline-tec/
Deploy target: inventario-a6aa3.web.app
```

## PROTOCOLO DE REGRESIÓN (15 minutos)

### FASE 1 — Build Gate (2 min)
```bash
cd /Users/danielabrego/Projects/topline-tec
npx tsc --noEmit 2>&1
npm run build 2>&1
```
Si falla: STOP. No continuar hasta que compile.

### FASE 2 — Unit Tests (2 min)
```bash
npx vitest run 2>&1
```
Si algún test falla: investigar y reparar antes de continuar.

### FASE 3 — Static Analysis (3 min)
```bash
npx eslint src/ --ext .ts,.tsx --max-warnings 0 2>&1 | head -50
```
Reportar errores nuevos (comparar con baseline).

### FASE 4 — Auditoría de cambios (5 min)
```bash
git log --oneline -10
git diff HEAD~3 --stat
```
Para CADA archivo modificado en los últimos 3 commits:
1. Leer el archivo completo
2. Verificar que los cambios son coherentes
3. Buscar regresiones obvias:
   - ¿Se eliminó un import que se usa?
   - ¿Se cambió una interfaz sin actualizar todos los consumidores?
   - ¿Se modificó una query de Firestore sin actualizar el índice?
   - ¿Se cambió un tipo sin actualizar los mocks de test?

### FASE 5 — Smoke Tests funcionales (3 min)
Leer estos archivos y verificar coherencia:
1. `src/App.tsx` — ¿Todas las rutas apuntan a componentes que existen?
2. `firestore.rules` — ¿Compila? ¿El catch-all deny sigue al final?
3. `src/services/firebase/transactions.ts` — ¿La transacción de venta es coherente?
4. `src/features/inventory/InventoryPage.tsx` — ¿Imports válidos?
5. `src/features/sales/components/PaymentModal.tsx` — ¿El store se usa correctamente?

### FASE 6 — Bundle Analysis
```bash
npm run build 2>&1 | grep "kB"
```
Verificar:
- InventoryPage < 200 KB (era 1,683 KB antes del fix)
- No hay chunks nuevos > 500 KB sin justificación
- Total bundle size no creció más de 10% vs último deploy

## REPORTE

```
## Regression Report — Top Line Tec
Fecha: [hoy]
Commit: [hash]

### Gates
- [ ] TypeScript: PASS/FAIL
- [ ] Build: PASS/FAIL (Xs)
- [ ] Unit Tests: N/N passing
- [ ] ESLint: N errors, N warnings
- [ ] Bundle size: InventoryPage = X KB

### Archivos modificados revisados
- [archivo]: OK / ISSUE: [descripción]

### Regresiones encontradas
- NINGUNA / [lista]

### Veredicto
SAFE TO DEPLOY / BLOCK DEPLOY: [razón]
```

## SI ENCUENTRA REGRESIONES
1. Documentar con archivo:línea
2. Si es un fix trivial (< 5 líneas): arreglar, correr tests, commit
3. Si es complejo: reportar como BLOCK DEPLOY y explicar impacto
