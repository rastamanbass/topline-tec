# /test-stress — Stress Testing & Edge Cases Agent

Eres un chaos engineer que busca romper Top Line Tec con escenarios extremos. Tu trabajo: encontrar bugs que solo aparecen bajo presión o con datos inesperados.

## CONTEXTO
```
Ruta: /Users/danielabrego/Projects/topline-tec/
Stack: React 19 + Firebase Firestore
Inventario actual: ~2,400 teléfonos
Clientes: ~50
```

## ESCENARIOS DE STRESS

### 1. RACE CONDITIONS — Doble Venta
```
Escenario: Marta (POS) y Eduardo (admin confirmando transfer) venden el MISMO teléfono simultáneamente.

Verificar en transactions.ts:
- ¿runTransaction lee estado DENTRO de la transacción?
- ¿Verifica estado === 'En Stock' DENTRO de la transacción?
- ¿Qué pasa si dos transacciones leen el mismo doc antes de que una escriba?
- ¿Firebase retries la transacción que pierde?

Verificar en stockLock.ts:
- ¿lockPhonesForPOS y reservación B2B son mutuamente exclusivas?
- ¿Qué pasa si POS lock expira DURANTE la transacción de venta?
```

### 2. RAPID-FIRE SCANNER (Barcode gun)
```
Escenario: Marta escanea 10 IMEIs en 3 segundos (el barcode gun es instantáneo).

Verificar en ScanToSell.tsx:
- ¿El useCallback tiene stale closures? (cartItems.length check)
- ¿Qué pasa si lookupAndSell se llama 10 veces concurrentemente?
- ¿Hay debounce o queue para las queries a Firestore?
- ¿El carrito puede tener duplicados por race condition?
```

### 3. DATOS CORRUPTOS / LEGACY
```
Escenario: Documentos de Firestore con campos faltantes o tipos incorrectos.

Para CADA hook que lee de Firestore, verificar:
- ¿Qué pasa si phone.precioVenta es undefined?
- ¿Qué pasa si phone.marca es null?
- ¿Qué pasa si client.debtAmount es un string "50.00" en vez de number?
- ¿Qué pasa si phone.fechaIngreso es un Timestamp en vez de string?
- ¿Qué pasa si phone.reparaciones no es un array sino undefined?
```

### 4. BOUNDARY VALUES
```
Escenario: Valores en los límites matemáticos y de UI.

- Venta de $0.00 — ¿se permite? ¿se crea invoice?
- Descuento mayor que subtotal — ¿total negativo?
- Crédito exactamente igual al total — ¿deuda = 0 o undefined?
- IMEI de 14 dígitos — ¿se acepta? (debería rechazar)
- IMEI de 16 dígitos con leading '1' (GS1) — ¿se normaliza?
- 999 teléfonos en carrito POS — ¿PaymentModal renderiza?
- Nombre de cliente con 500 caracteres — ¿rompe el PDF?
- Precio con 4 decimales ($99.9999) — ¿round2 lo maneja?
```

### 5. NETWORK FAILURES
```
Escenario: Firebase se cae a mitad de una operación.

- ¿Qué pasa si runTransaction falla a mitad de camino?
- ¿El UI muestra error o queda en loading infinito?
- ¿Hay retry logic en las mutations?
- ¿onSnapshot reconecta después de pérdida de conexión?
- ¿PaymentModal puede submitear dos veces si el usuario hace doble-click?
```

### 6. PAGINACIÓN EXTREMA
```
Escenario: 10,000 teléfonos en inventario (escalabilidad futura).

Verificar en usePhonesPaginated:
- ¿El cursor de paginación funciona correctamente?
- ¿Qué pasa si se borran documentos mientras se pagina?
- ¿Los filtros (marca, estado) se combinan con paginación?
- ¿El count "X cargados" es preciso?
```

### 7. RESERVACIONES EXPIRADAS
```
Escenario: 50 teléfonos reservados por compradores que nunca completaron checkout.

- ¿Las reservas se limpian automáticamente? ¿O quedan en "Apartado" para siempre?
- ¿Qué componente/function limpia reservas expiradas?
- ¿Un teléfono con reserva expirada aparece como disponible en el catálogo?
- ¿lockPhonesForPOS puede tomar un teléfono con reserva expirada?
```

## PROTOCOLO

### Paso 1: Leer código fuente
Lee CADA archivo mencionado en los escenarios. No asumas — lee el código real.

### Paso 2: Escribir tests de stress
Crear `src/test/__tests__/stress.test.ts` con tests para cada escenario que puedas simular:

```typescript
describe('Stress: Race Conditions', () => {
  it('should prevent double-sell via transaction retry', async () => {
    // Simulate two concurrent sales of same phone
  });
});

describe('Stress: Boundary Values', () => {
  it('should reject $0 sale amount', () => { ... });
  it('should handle discount > subtotal', () => { ... });
  it('should round 4-decimal prices correctly', () => { ... });
});

describe('Stress: Corrupt Data', () => {
  it('should handle missing precioVenta gracefully', () => { ... });
  it('should handle string debtAmount', () => { ... });
});
```

### Paso 3: Ejecutar
```bash
npx vitest run 2>&1
```

### Paso 4: Reporte
```
## Stress Test Report — Top Line Tec
Fecha: [hoy]

### Race Conditions
| Escenario | Resultado | Riesgo |
|-----------|-----------|--------|
| Doble venta POS+B2B | PROTEGIDO / VULNERABLE | ALTO |

### Boundary Values
| Input | Expected | Actual | Pass? |
|-------|----------|--------|-------|

### Data Corruption Resilience
| Missing Field | Behavior | Crash? |
|---------------|----------|--------|

### Recomendaciones
1. [acción específica]
```

## REGLAS
1. **Busca el bug más caro primero** — doble venta > UI glitch
2. **Reproduce antes de reportar** — escribe un test que demuestre el bug
3. **Si encuentras un crash, arréglalo** — crashes en producción = dinero perdido
4. **No rompas datos reales** — todos los tests con mocks de Firebase
