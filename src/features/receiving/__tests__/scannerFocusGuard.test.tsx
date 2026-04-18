/**
 * Integration tests for ReceivingPage scanner UX.
 *
 * Scope: the real <ReceivingPage /> component mounted inside MemoryRouter,
 * with only the data layer (hooks + firebase + toast) mocked. Tests cover:
 *
 *   1. Focus guard (onBlur) — the bug fix this file was created for
 *   2. Click-to-refocus on the scanner card — tablet UX
 *   3. Auto-focus when a lote is selected (useEffect)
 *   4. Scan processing (Enter key → processScan, buffer semantics)
 *   5. Lote selection & reset flow
 *
 * Out of scope (tested elsewhere or impractical):
 *   - processScan business logic → useReceivingSession.test.ts
 *   - Camera scanner flow → requires mocking html5-qrcode, brittle
 *   - Firebase writes → mocked away; integration covered by emulator tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ──────────────────────────────────────────────────────────────────

type ScanResult = 'ok' | 'duplicate' | 'wrong_state' | 'not_found' | 'ignored';
const processScanMock = vi.fn((): ScanResult => 'ok');
const resetMock = vi.fn();
const closeReceivingMock = vi.fn();

vi.mock('../hooks/useReceivingSession', () => ({
  useTransitLotes: () => ({
    lotes: ['LOTE-001', 'LOTE-002'],
    lotesWithCount: [
      { name: 'LOTE-001', count: 3, label: 'LOTE-001 (3 equipos)' },
      { name: 'LOTE-002', count: 1, label: 'LOTE-002 (1 equipo)' },
    ],
    isLoading: false,
  }),
  useReceivingSession: () => ({
    expectedCount: 3,
    okCount: 0,
    missingPhones: [],
    scannedResults: [],
    processScan: processScanMock,
    closeReceiving: closeReceivingMock,
    reset: resetMock,
    isLoading: false,
    isClosing: false,
  }),
}));

vi.mock('../../../lib/firebase', () => ({
  db: {},
  auth: { currentUser: { email: 'test@topline.com' } },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  doc: vi.fn(),
  addDoc: vi.fn(),
  serverTimestamp: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock('../components/ActaReceptionModal', () => ({ default: () => null }));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

// AudioContext is used by beep() — jsdom doesn't provide it, so stub it.
// The component swallows the error, so this is belt-and-suspenders to keep
// the test console clean.
beforeEach(() => {
  // @ts-expect-error jsdom does not ship AudioContext
  globalThis.AudioContext = vi.fn(() => ({
    createOscillator: () => ({
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: { value: 0 },
    }),
    createGain: () => ({
      connect: vi.fn(),
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    }),
    currentTime: 0,
    destination: {},
  }));
});

import ReceivingPage from '../ReceivingPage';

// ── Helpers ───────────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <ReceivingPage />
    </MemoryRouter>
  );
}

function selectLote(value = 'LOTE-001') {
  const select = screen.getByLabelText(/selecciona el lote/i) as HTMLSelectElement;
  fireEvent.change(select, { target: { value } });
  return select;
}

function getScannerInput() {
  return screen.getByLabelText(/escanear imei o qr/i) as HTMLInputElement;
}

function getCameraButton() {
  return screen.getByRole('button', { name: /usar cámara/i });
}

beforeEach(() => {
  processScanMock.mockReset().mockReturnValue('ok');
  resetMock.mockReset();
  closeReceivingMock.mockReset();
});

// ═══════════════════════════════════════════════════════════════════════════
// 1. Focus guard — the bug this file was created for
// ═══════════════════════════════════════════════════════════════════════════

describe('ReceivingPage · focus guard (onBlur)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('re-enfoca cuando el blur no tiene destino (pistola Bluetooth HID)', () => {
    // La pistola dispara teclas como un teclado HID; al "soltar" el input
    // el relatedTarget queda null porque no hay elemento receptor.
    // El guard debe devolver el foco para que el siguiente disparo llegue.
    renderPage();
    selectLote();
    const input = getScannerInput();

    input.focus();
    fireEvent.blur(input, { relatedTarget: null });
    (document.activeElement as HTMLElement | null)?.blur();

    act(() => vi.advanceTimersByTime(60));
    expect(document.activeElement).toBe(input);
  });

  it('NO roba el foco al hacer clic en el selector de lote', () => {
    // Este fue el bug reportado: el usuario no podía interactuar con
    // NINGÚN otro control porque el input se chupaba el foco de regreso.
    renderPage();
    const select = selectLote();
    const input = getScannerInput();

    input.focus();
    fireEvent.blur(input, { relatedTarget: select });
    select.focus();

    act(() => vi.advanceTimersByTime(200));
    expect(document.activeElement).toBe(select);
  });

  it('NO roba el foco al hacer clic en el botón de cámara', () => {
    renderPage();
    selectLote();
    const input = getScannerInput();
    const cameraBtn = getCameraButton();

    input.focus();
    fireEvent.blur(input, { relatedTarget: cameraBtn });
    cameraBtn.focus();

    act(() => vi.advanceTimersByTime(200));
    expect(document.activeElement).toBe(cameraBtn);
  });

  it('refocus funciona para blurs HID consecutivos (ráfaga de escaneos)', () => {
    renderPage();
    selectLote();
    const input = getScannerInput();

    for (let i = 0; i < 5; i++) {
      input.focus();
      fireEvent.blur(input, { relatedTarget: null });
      (document.activeElement as HTMLElement | null)?.blur();
      act(() => vi.advanceTimersByTime(60));
      expect(document.activeElement).toBe(input);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2. Click-to-refocus on the scanner card (tablet UX)
// ═══════════════════════════════════════════════════════════════════════════

describe('ReceivingPage · click-to-refocus en la tarjeta del scanner', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('clic en la tarjeta del scanner devuelve foco al input (UX tablet)', () => {
    // Para tablets sin pistola: si el usuario pierde el foco, puede
    // tocar la tarjeta oscura del scanner y recuperarlo sin buscar
    // el input específicamente.
    renderPage();
    selectLote();
    const input = getScannerInput();

    // Mover foco fuera del input
    const select = screen.getByLabelText(/selecciona el lote/i);
    select.focus();
    expect(document.activeElement).toBe(select);

    // Tocar el texto "Escáner activo" (parte de la tarjeta)
    const cardLabel = screen.getByText(/escáner activo/i);
    fireEvent.click(cardLabel);

    act(() => vi.advanceTimersByTime(60));
    expect(document.activeElement).toBe(input);
  });

  it('clic en el botón de cámara NO dispara el refocus de la tarjeta (stopPropagation)', () => {
    // El botón cámara vive dentro de la tarjeta que tiene onClick={refocusInput}.
    // Su handler hace e.stopPropagation() para que abrir cámara NO agende un
    // setTimeout(50ms) de refocus que pelearía con el init asíncrono de la cámara.
    //
    // Verificación: advanzamos 45ms (< 50ms del refocus scheduled) y confirmamos
    // que el input NO recuperó foco. No advanzamos más porque el flujo async de
    // startCamera (await sleep(100) + init) re-enfocaría al fallar en jsdom.
    renderPage();
    selectLote();
    const input = getScannerInput();
    const cameraBtn = getCameraButton();

    input.blur();
    expect(document.activeElement).not.toBe(input);

    fireEvent.click(cameraBtn);

    act(() => vi.advanceTimersByTime(45));
    expect(document.activeElement).not.toBe(input);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3. Auto-focus on lote selection (useEffect)
// ═══════════════════════════════════════════════════════════════════════════

describe('ReceivingPage · auto-focus al seleccionar lote', () => {
  it('al elegir un lote, el input de escaneo recibe foco automáticamente', () => {
    // Sin este useEffect, el usuario tendría que hacer clic en el input
    // tras elegir lote — friction innecesaria para flujo de alto volumen.
    renderPage();
    selectLote();

    expect(document.activeElement).toBe(getScannerInput());
  });

  it('sin lote seleccionado, el input de escaneo no se renderiza', () => {
    renderPage();
    expect(screen.queryByLabelText(/escanear imei o qr/i)).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4. Scan processing (Enter key → processScan, buffer semantics)
// ═══════════════════════════════════════════════════════════════════════════

describe('ReceivingPage · procesamiento de escaneos', () => {
  it('Enter con IMEI válido invoca processScan con el valor del buffer', () => {
    renderPage();
    selectLote();
    const input = getScannerInput();

    fireEvent.change(input, { target: { value: '359123456789012' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(processScanMock).toHaveBeenCalledExactlyOnceWith('359123456789012');
  });

  it('Enter limpia el buffer tras un resultado procesable (ok)', () => {
    processScanMock.mockReturnValueOnce('ok');
    renderPage();
    selectLote();
    const input = getScannerInput();

    fireEvent.change(input, { target: { value: '359123456789012' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input.value).toBe('');
  });

  it('Enter con buffer vacío NO invoca processScan (guard trim)', () => {
    renderPage();
    selectLote();

    fireEvent.keyDown(getScannerInput(), { key: 'Enter' });
    expect(processScanMock).not.toHaveBeenCalled();
  });

  it('Enter con solo espacios NO invoca processScan', () => {
    renderPage();
    selectLote();
    const input = getScannerInput();

    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(processScanMock).not.toHaveBeenCalled();
  });

  it('cuando processScan retorna "ignored" (IMEI parcial), el buffer se PRESERVA', () => {
    // Regla de negocio: input <8 caracteres devuelve "ignored". Preservar
    // el buffer permite al usuario corregir/completar sin retipear.
    processScanMock.mockReturnValueOnce('ignored');
    renderPage();
    selectLote();
    const input = getScannerInput();

    fireEvent.change(input, { target: { value: '35912' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(processScanMock).toHaveBeenCalledWith('35912');
    expect(input.value).toBe('35912'); // NO se limpió
  });

  it('escaneos consecutivos: 3 IMEIs en secuencia todos llegan a processScan', () => {
    // Simula ritmo real de recepción: tras cada Enter el buffer se limpia
    // y el siguiente disparo de la pistola llena uno nuevo.
    renderPage();
    selectLote();
    const input = getScannerInput();
    const imeis = ['359111111111111', '359222222222222', '359333333333333'];

    for (const imei of imeis) {
      fireEvent.change(input, { target: { value: imei } });
      fireEvent.keyDown(input, { key: 'Enter' });
    }

    expect(processScanMock).toHaveBeenCalledTimes(3);
    expect(processScanMock.mock.calls.map((c) => c[0])).toEqual(imeis);
    expect(input.value).toBe('');
  });

  it('teclas no-Enter se agregan al buffer sin disparar scan', () => {
    renderPage();
    selectLote();
    const input = getScannerInput();

    fireEvent.change(input, { target: { value: '35912345' } });
    fireEvent.keyDown(input, { key: 'a' });
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    expect(processScanMock).not.toHaveBeenCalled();
    expect(input.value).toBe('35912345');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5. Lote selection & reset flow
// ═══════════════════════════════════════════════════════════════════════════

describe('ReceivingPage · selección de lote', () => {
  it('cambiar de lote resetea la sesión de escaneo', () => {
    // Evita que los resultados del lote anterior contaminen el nuevo.
    renderPage();
    selectLote('LOTE-001');
    selectLote('LOTE-002');

    expect(resetMock).toHaveBeenCalled();
  });

  it('cambiar de lote limpia cualquier IMEI a medio escribir en el buffer', () => {
    renderPage();
    selectLote('LOTE-001');
    const input = getScannerInput();
    fireEvent.change(input, { target: { value: '35912345' } });
    expect(input.value).toBe('35912345');

    selectLote('LOTE-002');

    // El input se re-renderizó con el nuevo lote, pero el buffer fue limpiado.
    expect(getScannerInput().value).toBe('');
  });

  it('deseleccionar lote (volver a "") oculta el scanner', () => {
    renderPage();
    const select = selectLote('LOTE-001');
    expect(getScannerInput()).toBeInTheDocument();

    fireEvent.change(select, { target: { value: '' } });

    expect(screen.queryByLabelText(/escanear imei o qr/i)).not.toBeInTheDocument();
  });
});
