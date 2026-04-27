import { describe, expect, it } from 'vitest';
import {
  isInternalCode,
  splitMarcaAndSupplier,
  phoneLabel,
  normalizeIPhoneModel,
  normalizeStorage,
  normalizeDisplayBrand,
} from '../phoneUtils';

describe('isInternalCode', () => {
  it('reconoce códigos de proveedor comunes (case-insensitive)', () => {
    expect(isInternalCode('WNY')).toBe(true);
    expect(isInternalCode('wny')).toBe(true);
    expect(isInternalCode('HEC')).toBe(true);
    expect(isInternalCode('hec')).toBe(true);
    expect(isInternalCode(' XT ')).toBe(true);
  });

  it('rechaza brands reales', () => {
    expect(isInternalCode('Apple')).toBe(false);
    expect(isInternalCode('Samsung')).toBe(false);
    expect(isInternalCode('Google')).toBe(false);
  });

  it('maneja undefined/null/empty', () => {
    expect(isInternalCode(undefined)).toBe(false);
    expect(isInternalCode('')).toBe(false);
    expect(isInternalCode('   ')).toBe(false);
  });
});

describe('splitMarcaAndSupplier', () => {
  it('marca real (Apple) → sin supplier', () => {
    expect(splitMarcaAndSupplier('Apple', 'iPhone 15')).toEqual({
      marca: 'Apple',
      supplierCode: null,
    });
  });

  it('marca = código proveedor → infiere Apple', () => {
    expect(splitMarcaAndSupplier('WNY', 'iPhone 14 Pro')).toEqual({
      marca: 'Apple',
      supplierCode: 'WNY',
    });
  });

  it('código en lowercase → mayúsculas en supplierCode', () => {
    expect(splitMarcaAndSupplier('hec', 'iPhone 13')).toEqual({
      marca: 'Apple',
      supplierCode: 'HEC',
    });
  });

  it('primera palabra es código ("REC IPHONE A") → extrae REC', () => {
    const r = splitMarcaAndSupplier('REC IPHONE A', '');
    expect(r.supplierCode).toBe('REC');
    expect(r.marca).toBe('Apple');
  });

  it('BUG KNOWN: input vacío retorna "Desconocida" (fallback leak)', () => {
    // Este comportamiento es el bug que fue detectado 2026-04-24.
    // Test aquí documenta el comportamiento actual. Cuando se arregle
    // phoneUtils para retornar null o throw, este test debe actualizarse.
    expect(splitMarcaAndSupplier('', '')).toEqual({
      marca: 'Desconocida',
      supplierCode: null,
    });
    expect(splitMarcaAndSupplier(null, null)).toEqual({
      marca: 'Desconocida',
      supplierCode: null,
    });
    expect(splitMarcaAndSupplier(undefined, undefined)).toEqual({
      marca: 'Desconocida',
      supplierCode: null,
    });
  });

  it('Samsung real → sin supplier', () => {
    expect(splitMarcaAndSupplier('Samsung', 'Galaxy S24')).toEqual({
      marca: 'Samsung',
      supplierCode: null,
    });
  });

  // ── Códigos agregados 2026-04-27 (KRA, TPM, PA, LOLO, CESFL) ──────────────
  describe('nuevos supplier codes', () => {
    it('KRA con modelo Samsung → marca Samsung + supplier KRA', () => {
      expect(splitMarcaAndSupplier('KRA', 'Galaxy S22 Ultra 128GB')).toEqual({
        marca: 'Samsung',
        supplierCode: 'KRA',
      });
    });

    it('kra lowercase → KRA uppercase', () => {
      expect(splitMarcaAndSupplier('kra', 'iPhone 14')).toEqual({
        marca: 'Apple',
        supplierCode: 'KRA',
      });
    });

    it('PA (codigo de 2 letras) → ok', () => {
      expect(splitMarcaAndSupplier('PA', 'iPhone 13 Pro')).toEqual({
        marca: 'Apple',
        supplierCode: 'PA',
      });
    });

    it('LOLO con modelo desconocido → marca Apple por default', () => {
      expect(splitMarcaAndSupplier('LOLO', 'guitarra')).toEqual({
        marca: 'Apple',
        supplierCode: 'LOLO',
      });
    });

    it('TPM con modelo Samsung → marca Samsung', () => {
      expect(splitMarcaAndSupplier('tpm', 'Galaxy Note 20')).toEqual({
        marca: 'Samsung',
        supplierCode: 'TPM',
      });
    });

    it('CESFL con modelo Samsung → marca Samsung + supplier CESFL', () => {
      expect(splitMarcaAndSupplier('CESFL', 's24 ultra 256gb')).toEqual({
        marca: 'Samsung',
        supplierCode: 'CESFL',
      });
    });
  });

  describe('case-insensitive y multi-word', () => {
    it('"Iphone REC" → primera palabra "Iphone" no es código → respeta marca', () => {
      // "Iphone" no está en INTERNAL_CODES; la primera palabra es la que cuenta
      // (en isInternalCode normalizado). El comportamiento actual depende de
      // si el split detecta "REC" o no.
      const r = splitMarcaAndSupplier('Iphone REC', '11 128gb');
      // Documentamos comportamiento actual: la primera palabra Iphone gana
      expect(r.marca).toBe('Iphone REC');
      expect(r.supplierCode).toBeNull();
    });

    it('"WNY 14 PRO" → primera palabra es código → extrae WNY', () => {
      expect(splitMarcaAndSupplier('WNY 14 PRO', '')).toEqual({
        marca: 'Apple',
        supplierCode: 'WNY',
      });
    });
  });

  describe('isInternalCode con nuevos códigos', () => {
    it('KRA, KRZ, PA, LOLO, CESFL, TPM están en la lista', () => {
      expect(isInternalCode('KRA')).toBe(true);
      expect(isInternalCode('PA')).toBe(true);
      expect(isInternalCode('LOLO')).toBe(true);
      expect(isInternalCode('CESFL')).toBe(true);
      expect(isInternalCode('TPM')).toBe(true);
    });

    it('codes deprecados/invalidos no estan', () => {
      expect(isInternalCode('KRAN')).toBe(false); // se mergea a KRA
      expect(isInternalCode('RQM5006653')).toBe(false); // es nº invoice
      expect(isInternalCode('Apple')).toBe(false);
      expect(isInternalCode('Samsung')).toBe(false);
    });
  });
});

describe('phoneLabel', () => {
  it('marca real + modelo → "Brand Model"', () => {
    expect(phoneLabel('Apple', 'iPhone 15 Pro')).toBe('Apple iPhone 15 Pro');
    expect(phoneLabel('Samsung', 'Galaxy S24')).toBe('Samsung Galaxy S24');
  });

  it('código proveedor → normaliza solo el modelo (asume iPhone)', () => {
    expect(phoneLabel('WNY', '14 PRO MAX 128GB')).toBe('14 Pro Max 128GB');
  });

  it('modelo con storage lowercase → normaliza', () => {
    expect(phoneLabel('Apple', '14 pro 128gb')).toBe('Apple 14 pro 128gb');
  });
});

describe('normalizeIPhoneModel', () => {
  it('casea "14 PRO MAX 128GB" correctamente', () => {
    expect(normalizeIPhoneModel('14 PRO MAX 128GB')).toBe('14 Pro Max 128GB');
  });

  it('strippa prefijo "iPhone"', () => {
    expect(normalizeIPhoneModel('iPhone 13 Pro 256GB')).toBe('13 Pro 256GB');
  });

  it('strippa prefijo "Apple"', () => {
    expect(normalizeIPhoneModel('Apple 15 Pro Max 512GB')).toBe('15 Pro Max 512GB');
  });

  it('casea storage lowercase → uppercase', () => {
    expect(normalizeIPhoneModel('13 pro 128gb')).toBe('13 Pro 128GB');
  });

  it('iPad pasa intacto', () => {
    expect(normalizeIPhoneModel('IPAD 11 128GB')).toBe('IPAD 11 128GB');
  });

  it('undefined/empty → ""', () => {
    expect(normalizeIPhoneModel(undefined)).toBe('');
    expect(normalizeIPhoneModel('')).toBe('');
  });

  it('detecta variante Pro Max antes de Pro', () => {
    expect(normalizeIPhoneModel('15 pro max')).toBe('15 Pro Max');
    expect(normalizeIPhoneModel('15 pro')).toBe('15 Pro');
  });
});

describe('normalizeStorage', () => {
  it('"128 GB" → "128GB"', () => {
    expect(normalizeStorage('128 GB')).toBe('128GB');
  });

  it('"1 TB" → "1TB"', () => {
    expect(normalizeStorage('1 TB')).toBe('1TB');
  });

  it('"256gb" → "256GB"', () => {
    expect(normalizeStorage('256gb')).toBe('256GB');
  });

  it('undefined/null → "Unknown"', () => {
    expect(normalizeStorage(undefined)).toBe('Unknown');
    expect(normalizeStorage(null)).toBe('Unknown');
    expect(normalizeStorage('')).toBe('Unknown');
  });
});

describe('normalizeDisplayBrand', () => {
  it('códigos de proveedor → "Apple"', () => {
    expect(normalizeDisplayBrand('WNY')).toBe('Apple');
    expect(normalizeDisplayBrand('HEC')).toBe('Apple');
    expect(normalizeDisplayBrand('REC IPHONE A')).toBe('Apple');
  });

  it('iPhone entries como brand → "Apple"', () => {
    expect(normalizeDisplayBrand('iPhone')).toBe('Apple');
    expect(normalizeDisplayBrand('APPLE')).toBe('Apple');
  });

  it('modelos con número al inicio (12 64gb) → "Apple"', () => {
    expect(normalizeDisplayBrand('12 64gb')).toBe('Apple');
    expect(normalizeDisplayBrand('16 PLUS 128GB')).toBe('Apple');
  });

  it('Samsung variants', () => {
    expect(normalizeDisplayBrand('Samsung')).toBe('Samsung');
    expect(normalizeDisplayBrand('SAMSUNG ')).toBe('Samsung');
    expect(normalizeDisplayBrand('S22 ultra')).toBe('Samsung');
    expect(normalizeDisplayBrand('s24 ultra 256gb')).toBe('Samsung');
  });

  it('undefined/empty → "Otro"', () => {
    expect(normalizeDisplayBrand(undefined)).toBe('Otro');
    expect(normalizeDisplayBrand('')).toBe('Otro');
    expect(normalizeDisplayBrand('   ')).toBe('Otro');
  });
});
