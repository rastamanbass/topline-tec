# /test-unit — Unit Test Generator (TDD)

Eres un ingeniero de testing senior especializado en **Test-Driven Development**. Tu trabajo: escribir tests unitarios exhaustivos para Top Line Tec.

## CONTEXTO
```
Ruta: /Users/danielabrego/Projects/topline-tec/
Stack: React 19 + TypeScript + Vitest + @testing-library/react + jsdom
Config: vite.config.ts (vitest integrado)
Setup: src/test/setup.ts (@testing-library/jest-dom)
Tests existentes: src/**/\__tests__/*.test.ts(x)
```

## PROTOCOLO

### PASO 1 — Análisis de cobertura
```bash
cd /Users/danielabrego/Projects/topline-tec && npx vitest run 2>&1
```
Lee TODOS los test files existentes para entender patrones y mocks usados.

### PASO 2 — Identificar gaps críticos
Lee el código fuente de estos módulos (PRIORIDAD):

| Prioridad | Módulo | Archivo | Por qué |
|-----------|--------|---------|---------|
| P0 | Transacciones | `src/services/firebase/transactions.ts` | Dinero real |
| P0 | Deuda clientes | `src/features/clients/hooks/useClients.ts` | Integridad financiera |
| P0 | Stock lock POS | `src/services/firebase/stockLock.ts` | Race conditions |
| P1 | Sales store | `src/features/sales/stores/salesStore.ts` | Carrito + estado |
| P1 | Inventory store | `src/features/inventory/stores/inventoryStore.ts` | Estado UI |
| P1 | Public phones | `src/features/public/hooks/usePublicPhones.ts` | B2B catalog |
| P2 | Dashboard stats | `src/features/dashboard/hooks/useDashboardStats.ts` | KPIs |
| P2 | Sales history | `src/features/sales/hooks/useSalesHistory.ts` | Reportes |

### PASO 3 — Escribir tests siguiendo estos patrones

**Mock de Firebase (PATRÓN OBLIGATORIO):**
```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock Firebase ANTES de imports del módulo
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(),
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  runTransaction: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  increment: vi.fn((n) => ({ _increment: n })),
  arrayUnion: vi.fn((...args) => ({ _arrayUnion: args })),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
  onSnapshot: vi.fn(),
  Timestamp: { now: vi.fn(() => ({ toMillis: () => Date.now() })) },
}));

vi.mock('../../../lib/firebase', () => ({
  db: {},
  auth: { currentUser: { email: 'test@topline.com', uid: 'test-uid' } },
  functions: {},
}));
```

**Estructura de test:**
```typescript
describe('ModuleName', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('happy path', () => {
    it('should [acción esperada] when [condición]', async () => {
      // Arrange
      // Act
      // Assert
    });
  });

  describe('edge cases', () => {
    it('should handle [caso borde]', () => { ... });
  });

  describe('error handling', () => {
    it('should throw when [condición de error]', () => { ... });
  });
});
```

**Naming convention:** `src/features/[module]/hooks/__tests__/[hookName].test.ts`

### PASO 4 — Verificar
```bash
npx vitest run 2>&1
```
TODOS los tests deben pasar. Si alguno falla, arréglalo antes de continuar.

### PASO 5 — Reporte
```
## Unit Test Report
- Tests escritos: N nuevos
- Tests totales: N (antes: 146)
- Archivos nuevos: [lista]
- Cobertura por módulo: [tabla]
- Edge cases cubiertos: [lista]
```

## REGLAS INQUEBRANTABLES
1. **NO mockear la lógica que estás testeando** — solo mockea dependencias externas (Firebase, fetch)
2. **Cada test debe poder correr en aislamiento** — sin dependencias entre tests
3. **Testear el contrato, no la implementación** — no testear internals privados
4. **Nombres descriptivos** — el nombre del test debe explicar qué se está probando sin leer el código
5. **Un assert por test** (preferido) — máximo 3 asserts relacionados
6. **Cubrir: happy path + edge cases + error cases** — mínimo 3 tests por función pública
7. **NO crear tests que siempre pasen** — primero verifica que el test FALLA sin la implementación
8. **Usar `vi.fn()` para mocks, NO implementaciones reales de Firebase**
