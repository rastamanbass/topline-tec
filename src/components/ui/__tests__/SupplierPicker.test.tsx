/**
 * SupplierPicker integration tests.
 *
 * Cubre:
 * - Render baseline (codigos hardcoded disponibles via mocks)
 * - Render badge cuando hay value seleccionado
 * - Filtrado mientras tipeas
 * - Selección de código existente → onChange
 * - Botón × → onChange(null)
 * - Validación de formato (regex /^[A-Z0-9]{1,12}$/)
 * - Modal de confirmación cuando tipeas código nuevo
 * - addInternalCode llamado al confirmar
 * - Escape cierra el dropdown
 * - Portal escapa contenedores con overflow-hidden
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock internalCodes module to avoid Firebase dependency
vi.mock('../../../lib/internalCodes', () => ({
  useInternalCodes: () => ['ANG', 'CESFL', 'KRA', 'LOLO', 'PA', 'REC', 'TPM', 'WNY', 'XT'],
  addInternalCode: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

import SupplierPicker from '../SupplierPicker';
import { addInternalCode } from '../../../lib/internalCodes';

describe('SupplierPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('render', () => {
    it('renderiza input cuando no hay value', () => {
      render(<SupplierPicker value={null} onChange={() => {}} />);
      const input = screen.getByPlaceholderText(/codigo de proveedor/i);
      expect(input).toBeInTheDocument();
      expect((input as HTMLInputElement).value).toBe('');
    });

    it('renderiza badge cuando hay value seleccionado', () => {
      render(<SupplierPicker value="KRA" onChange={() => {}} />);
      expect(screen.getByText('KRA')).toBeInTheDocument();
      expect(screen.getByLabelText(/limpiar codigo/i)).toBeInTheDocument();
    });

    it('placeholder custom funciona', () => {
      render(<SupplierPicker value={null} onChange={() => {}} placeholder="Asignar a todas..." />);
      expect(screen.getByPlaceholderText('Asignar a todas...')).toBeInTheDocument();
    });
  });

  describe('clear (X button)', () => {
    it('clic en × llama onChange(null)', () => {
      const onChange = vi.fn();
      render(<SupplierPicker value="WNY" onChange={onChange} />);
      fireEvent.click(screen.getByLabelText(/limpiar codigo/i));
      expect(onChange).toHaveBeenCalledExactlyOnceWith(null);
    });
  });

  describe('dropdown + filtrado', () => {
    it('focus en input abre dropdown con todos los codes', () => {
      render(<SupplierPicker value={null} onChange={() => {}} />);
      const input = screen.getByPlaceholderText(/codigo de proveedor/i);
      fireEvent.focus(input);
      // Codes hardcoded del mock
      expect(screen.getByText('WNY')).toBeInTheDocument();
      expect(screen.getByText('KRA')).toBeInTheDocument();
      expect(screen.getByText('CESFL')).toBeInTheDocument();
    });

    it('tipear "K" filtra a códigos que contienen K', () => {
      render(<SupplierPicker value={null} onChange={() => {}} />);
      const input = screen.getByPlaceholderText(/codigo de proveedor/i);
      fireEvent.change(input, { target: { value: 'K' } });
      // Esperar update via codes.includes('K')
      expect(screen.getByText('KRA')).toBeInTheDocument();
      // ANG no contiene K
      expect(screen.queryByText('ANG')).not.toBeInTheDocument();
    });

    it('tipear "REC" filtra a REC exact', () => {
      render(<SupplierPicker value={null} onChange={() => {}} />);
      const input = screen.getByPlaceholderText(/codigo de proveedor/i);
      fireEvent.change(input, { target: { value: 'REC' } });
      expect(screen.getByText('REC')).toBeInTheDocument();
      expect(screen.queryByText('WNY')).not.toBeInTheDocument();
    });

    it('input convierte a uppercase mientras se tipea', () => {
      render(<SupplierPicker value={null} onChange={() => {}} />);
      const input = screen.getByPlaceholderText(/codigo de proveedor/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'kra' } });
      expect(input.value).toBe('KRA');
    });

    it('clic en código del dropdown llama onChange', () => {
      const onChange = vi.fn();
      render(<SupplierPicker value={null} onChange={onChange} />);
      const input = screen.getByPlaceholderText(/codigo de proveedor/i);
      fireEvent.focus(input);
      fireEvent.click(screen.getByText('WNY'));
      expect(onChange).toHaveBeenCalledExactlyOnceWith('WNY');
    });
  });

  describe('keyboard', () => {
    it('Enter con código existente lo selecciona', () => {
      const onChange = vi.fn();
      render(<SupplierPicker value={null} onChange={onChange} />);
      const input = screen.getByPlaceholderText(/codigo de proveedor/i);
      fireEvent.change(input, { target: { value: 'WNY' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledExactlyOnceWith('WNY');
    });

    it('Enter con un solo match en filtro lo selecciona', () => {
      const onChange = vi.fn();
      render(<SupplierPicker value={null} onChange={onChange} />);
      const input = screen.getByPlaceholderText(/codigo de proveedor/i);
      fireEvent.change(input, { target: { value: 'CESF' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(onChange).toHaveBeenCalledExactlyOnceWith('CESFL');
    });

    it('Escape cierra el dropdown', () => {
      render(<SupplierPicker value={null} onChange={() => {}} />);
      const input = screen.getByPlaceholderText(/codigo de proveedor/i);
      fireEvent.focus(input);
      expect(screen.getByText('WNY')).toBeInTheDocument();
      fireEvent.keyDown(input, { key: 'Escape' });
      expect(screen.queryByText('WNY')).not.toBeInTheDocument();
    });
  });

  describe('agregar código nuevo', () => {
    it('tipear código que no existe muestra opción "Agregar nuevo"', () => {
      render(<SupplierPicker value={null} onChange={() => {}} />);
      const input = screen.getByPlaceholderText(/codigo de proveedor/i);
      fireEvent.change(input, { target: { value: 'NEWCODE' } });
      expect(screen.getByText(/agregar nuevo codigo/i)).toBeInTheDocument();
      expect(screen.getByText('NEWCODE')).toBeInTheDocument();
    });

    it('código inválido (símbolos) muestra mensaje de error', () => {
      render(<SupplierPicker value={null} onChange={() => {}} />);
      const input = screen.getByPlaceholderText(/codigo de proveedor/i);
      fireEvent.change(input, { target: { value: '!!!' } });
      expect(screen.getByText(/codigo invalido/i)).toBeInTheDocument();
    });

    it('código de >12 chars no se permite agregar', () => {
      render(<SupplierPicker value={null} onChange={() => {}} />);
      const input = screen.getByPlaceholderText(/codigo de proveedor/i);
      fireEvent.change(input, { target: { value: 'TOOLONGCODENAME' } });
      // 15 chars > 12, regex /^[A-Z0-9]{1,12}$/ falla, no aparece "agregar nuevo"
      expect(screen.queryByText(/agregar nuevo codigo/i)).not.toBeInTheDocument();
    });

    it('clic en "Agregar nuevo" abre modal de confirmación', () => {
      render(<SupplierPicker value={null} onChange={() => {}} />);
      const input = screen.getByPlaceholderText(/codigo de proveedor/i);
      fireEvent.change(input, { target: { value: 'XYZ' } });
      fireEvent.click(screen.getByText(/agregar nuevo codigo/i));
      expect(screen.getByText(/nuevo codigo de proveedor/i)).toBeInTheDocument();
    });

    it('confirmar en modal llama addInternalCode + onChange', async () => {
      const onChange = vi.fn();
      render(<SupplierPicker value={null} onChange={onChange} />);
      const input = screen.getByPlaceholderText(/codigo de proveedor/i);
      fireEvent.change(input, { target: { value: 'XYZ' } });
      fireEvent.click(screen.getByText(/agregar nuevo codigo/i));
      // Modal abierto
      const confirmBtn = screen.getByRole('button', { name: /si.*agregarlo/i });
      fireEvent.click(confirmBtn);
      await waitFor(() => {
        expect(addInternalCode).toHaveBeenCalledExactlyOnceWith('XYZ');
        expect(onChange).toHaveBeenCalledExactlyOnceWith('XYZ');
      });
    });

    it('cancelar en modal NO llama addInternalCode', () => {
      const onChange = vi.fn();
      render(<SupplierPicker value={null} onChange={onChange} />);
      const input = screen.getByPlaceholderText(/codigo de proveedor/i);
      fireEvent.change(input, { target: { value: 'XYZ' } });
      fireEvent.click(screen.getByText(/agregar nuevo codigo/i));
      const cancelBtn = screen.getByRole('button', { name: /no.*cancelar/i });
      fireEvent.click(cancelBtn);
      expect(addInternalCode).not.toHaveBeenCalled();
      expect(onChange).not.toHaveBeenCalled();
    });

    it('Enter con código nuevo válido abre el modal directo', () => {
      render(<SupplierPicker value={null} onChange={() => {}} />);
      const input = screen.getByPlaceholderText(/codigo de proveedor/i);
      fireEvent.change(input, { target: { value: 'NEWCODE' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(screen.getByText(/nuevo codigo de proveedor/i)).toBeInTheDocument();
    });
  });

  describe('portal escape overflow', () => {
    it('dropdown se renderiza en document.body (no dentro del container)', () => {
      const { container } = render(
        <div style={{ overflow: 'hidden', height: '50px' }}>
          <SupplierPicker value={null} onChange={() => {}} />
        </div>
      );
      const input = screen.getByPlaceholderText(/codigo de proveedor/i);
      fireEvent.focus(input);
      // El dropdown debe existir en el DOM pero NO dentro del container
      const wnyOption = screen.getByText('WNY');
      expect(wnyOption).toBeInTheDocument();
      expect(container.contains(wnyOption)).toBe(false);
    });
  });
});
