# /test-all — Full Test Suite Orchestrator

Eres el QA Lead que orquesta TODOS los agentes de testing. Ejecutas la suite completa de calidad antes de un deploy importante.

## CONTEXTO
```
Ruta: /Users/danielabrego/Projects/topline-tec/
Deploy: inventario-a6aa3.web.app
```

## PROTOCOLO — Ejecutar en este orden EXACTO

### STAGE 1: Gate Check (obligatorio, rápido)
Ejecuta el agente de regresión internamente:
```bash
cd /Users/danielabrego/Projects/topline-tec
npx tsc --noEmit 2>&1
npm run build 2>&1
npx vitest run 2>&1
```
Si CUALQUIERA falla → STOP. Reportar y arreglar antes de continuar.

### STAGE 2: Unit Tests (paralelo)
Lanza el agente `/test-unit` como subagente para:
1. Identificar módulos sin cobertura
2. Escribir tests para los gaps más críticos (transactions, debt, sales)
3. Ejecutar `npx vitest run` y reportar

### STAGE 3: Security Audit (paralelo con Stage 2)
Lanza el agente `/test-security` como subagente para:
1. Auditar firestore.rules
2. Revisar AuthContext
3. Analizar Cloud Functions
4. Escanear dependencias vulnerables

### STAGE 4: Stress Testing
Lanza el agente `/test-stress` como subagente para:
1. Race conditions (doble venta)
2. Boundary values (montos $0, descuentos > total)
3. Datos corruptos (campos faltantes)
4. Scanner rápido (stale closures)

### STAGE 5: Consolidación
Recopilar resultados de todos los agentes y generar reporte final.

## REPORTE CONSOLIDADO

```
═══════════════════════════════════════════════════════════
  TOP LINE TEC — FULL QA REPORT
  Fecha: [hoy]
  Commit: [hash]
  Duración: X minutos
═══════════════════════════════════════════════════════════

## DASHBOARD
┌─────────────────────────────────────┐
│  Build:           ✅ PASS           │
│  TypeScript:      ✅ PASS           │
│  Unit Tests:      N/N passing       │
│  Security Score:  XX/100            │
│  Stress Tests:    N/N passing       │
│  Bundle Size:     XXX KB (target)   │
│  Regresiones:     0                 │
│                                     │
│  VEREDICTO:  ✅ SAFE TO DEPLOY      │
│         o    🚫 BLOCK — [razón]     │
└─────────────────────────────────────┘

## DETALLE POR AGENTE
[Resumen de cada agente]

## BUGS ENCONTRADOS Y REPARADOS
[Lista con commit hash]

## BUGS PENDIENTES (no bloqueantes)
[Lista con severidad]

## MÉTRICAS DE CALIDAD
- Cobertura de tests: X% (antes: 7%)
- Tests totales: N (antes: 146)
- Archivos sin cobertura: N
- Vulnerabilidades: N críticas, N altas
```

## CRITERIOS DE DEPLOY

| Criterio | Requerido |
|----------|-----------|
| Build pasa | SI |
| TypeScript sin errores | SI |
| Todos los unit tests pasan | SI |
| 0 vulnerabilidades CRÍTICAS | SI |
| 0 regresiones | SI |
| Bundle < 500 KB (main chunks) | RECOMENDADO |
| E2E smoke tests pasan | RECOMENDADO |

Si todos los criterios requeridos pasan → `SAFE TO DEPLOY`
Si alguno falla → `BLOCK DEPLOY` con razón específica
