import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useRef, useCallback } from 'react';

// Harness that reproduces the exact onBlur pattern from ReceivingPage.
// If refocusInput ran unconditionally on blur, clicking any other UI element
// (lote select, camera button, etc) would ping-pong focus back to the IMEI
// input and lock the user out of every other control.
function ScannerHarness({ onRefocus }: { onRefocus: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  const refocusInput = useCallback(() => {
    onRefocus();
    inputRef.current?.focus();
  }, [onRefocus]);

  return (
    <div>
      <input
        ref={inputRef}
        data-testid="imei"
        onBlur={(e) => {
          if (e.relatedTarget === null) refocusInput();
        }}
      />
      <button data-testid="other-button">Lote</button>
    </div>
  );
}

describe('ReceivingPage scanner focus guard', () => {
  let refocusSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    refocusSpy = vi.fn();
  });

  it('re-enfoca cuando el blur no tiene destino (pistola Bluetooth HID)', () => {
    const { getByTestId } = render(<ScannerHarness onRefocus={refocusSpy} />);
    const input = getByTestId('imei') as HTMLInputElement;

    input.focus();
    // Blur nativo sin relatedTarget — el caso de la pistola que dispara teclas
    // sin transferir foco a otro elemento interactivo.
    fireEvent.blur(input, { relatedTarget: null });

    expect(refocusSpy).toHaveBeenCalledTimes(1);
  });

  it('NO re-enfoca cuando el usuario hace clic en otro elemento', () => {
    const { getByTestId } = render(<ScannerHarness onRefocus={refocusSpy} />);
    const input = getByTestId('imei') as HTMLInputElement;
    const other = getByTestId('other-button');

    input.focus();
    // Blur con relatedTarget — clic intencional del usuario en otro control.
    fireEvent.blur(input, { relatedTarget: other });

    expect(refocusSpy).not.toHaveBeenCalled();
  });
});
