import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

// ── Mocks ──────────────────────────────────────────────────────────────────
// We mock only the hook layer + firebase so we exercise the REAL ReceivingPage
// component (JSX, event wiring, focus guard). If the onBlur guard regresses
// in the actual source file, these tests will fail.

const processScanMock = vi.fn(() => 'ok' as const);
const resetMock = vi.fn();
const closeReceivingMock = vi.fn();

vi.mock('../hooks/useReceivingSession', () => ({
  useTransitLotes: () => ({
    lotes: ['LOTE-001'],
    lotesWithCount: [{ name: 'LOTE-001', count: 3, label: 'LOTE-001 (3 equipos)' }],
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

vi.mock('../components/ActaReceptionModal', () => ({
  default: () => null,
}));

// react-hot-toast — stub so beep()/toast() calls don't crash in jsdom
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

import ReceivingPage from '../ReceivingPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <ReceivingPage />
    </MemoryRouter>
  );
}

function selectLote() {
  const select = screen.getByLabelText(/selecciona el lote/i) as HTMLSelectElement;
  fireEvent.change(select, { target: { value: 'LOTE-001' } });
  return select;
}

function getScannerInput() {
  return screen.getByLabelText(/escanear imei o qr/i) as HTMLInputElement;
}

describe('ReceivingPage — focus guard (onBlur)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    processScanMock.mockClear();
    resetMock.mockClear();
  });

  it('re-enfoca el input cuando el blur no tiene destino (pistola HID)', () => {
    renderPage();
    selectLote();
    const input = getScannerInput();

    input.focus();
    expect(document.activeElement).toBe(input);

    // Blur sin relatedTarget = pistola disparando teclas al void
    fireEvent.blur(input, { relatedTarget: null });
    // Mover foco fuera para poder verificar que vuelve
    (document.activeElement as HTMLElement | null)?.blur();
    document.body.focus();

    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(document.activeElement).toBe(input);
  });

  it('NO roba el foco cuando el usuario hace clic en el selector de lote', () => {
    renderPage();
    const select = selectLote();
    const input = getScannerInput();

    input.focus();
    // Simular tab/clic hacia el select: blur con relatedTarget definido
    fireEvent.blur(input, { relatedTarget: select });
    select.focus();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    // El foco debe quedar donde el usuario lo puso, no regresar al input
    expect(document.activeElement).toBe(select);
  });

  it('NO roba el foco cuando el usuario hace clic en el botón de cámara', () => {
    renderPage();
    selectLote();
    const input = getScannerInput();
    const cameraBtn = screen.getByRole('button', { name: /usar cámara/i });

    input.focus();
    fireEvent.blur(input, { relatedTarget: cameraBtn });
    cameraBtn.focus();

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(document.activeElement).toBe(cameraBtn);
  });
});

describe('ReceivingPage — scanner keyboard handling', () => {
  beforeEach(() => {
    processScanMock.mockClear();
    resetMock.mockClear();
  });

  it('Enter con IMEI en el buffer llama a processScan con el valor', () => {
    renderPage();
    selectLote();
    const input = getScannerInput();

    fireEvent.change(input, { target: { value: '359123456789012' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(processScanMock).toHaveBeenCalledTimes(1);
    expect(processScanMock).toHaveBeenCalledWith('359123456789012');
  });

  it('Enter limpia el buffer tras escaneo exitoso', () => {
    renderPage();
    selectLote();
    const input = getScannerInput();

    fireEvent.change(input, { target: { value: '359123456789012' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(input.value).toBe('');
  });

  it('Enter con buffer vacío NO llama a processScan', () => {
    renderPage();
    selectLote();
    const input = getScannerInput();

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(processScanMock).not.toHaveBeenCalled();
  });

  it('Enter con solo espacios NO llama a processScan', () => {
    renderPage();
    selectLote();
    const input = getScannerInput();

    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(processScanMock).not.toHaveBeenCalled();
  });

  it('teclas no-Enter no disparan processScan pero sí modifican el buffer', () => {
    renderPage();
    selectLote();
    const input = getScannerInput();

    fireEvent.change(input, { target: { value: '35912345' } });
    fireEvent.keyDown(input, { key: 'a' });
    fireEvent.keyDown(input, { key: 'Tab' });

    expect(processScanMock).not.toHaveBeenCalled();
    expect(input.value).toBe('35912345');
  });

  it('processScan que retorna "ignored" no rompe el flujo', () => {
    processScanMock.mockReturnValueOnce('ignored' as unknown as 'ok');
    renderPage();
    selectLote();
    const input = getScannerInput();

    fireEvent.change(input, { target: { value: '000000000000000' } });
    expect(() => {
      fireEvent.keyDown(input, { key: 'Enter' });
    }).not.toThrow();

    expect(processScanMock).toHaveBeenCalledWith('000000000000000');
  });
});

describe('ReceivingPage — UI estado inicial', () => {
  it('no muestra el input del scanner hasta seleccionar un lote', () => {
    renderPage();

    expect(screen.queryByLabelText(/escanear imei o qr/i)).not.toBeInTheDocument();
  });

  it('muestra el input del scanner tras seleccionar un lote', () => {
    renderPage();
    selectLote();

    expect(screen.getByLabelText(/escanear imei o qr/i)).toBeInTheDocument();
  });

  it('cambiar de lote llama a reset() y limpia el buffer', () => {
    renderPage();
    const select = selectLote();
    const input = getScannerInput();

    fireEvent.change(input, { target: { value: '35912345' } });
    expect(input.value).toBe('35912345');

    // Cambiar a "sin lote"
    fireEvent.change(select, { target: { value: '' } });

    expect(resetMock).toHaveBeenCalled();
  });
});
