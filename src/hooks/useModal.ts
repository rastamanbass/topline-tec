import { useEffect, useRef } from 'react';

/**
 * useModal — accesibilidad completa para modales
 * - Cierra con Escape (cuando no está pendiente una operación)
 * - Focus trap: Tab/Shift+Tab se quedan dentro del modal
 * - Retorna el ref para asignarlo al contenedor del modal
 */
export function useModal(onClose: () => void, options?: { disabled?: boolean }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (options?.disabled) return;

    // Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      // Focus trap (Tab / Shift+Tab)
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ');

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelectors));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Focus first element on open
    const timer = setTimeout(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const first = dialog.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      first?.focus();
    }, 50);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [onClose, options?.disabled]);

  return { dialogRef };
}
