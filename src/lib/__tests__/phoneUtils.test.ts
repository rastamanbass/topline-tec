import { describe, it, expect } from 'vitest';
import {
  isInternalCode,
  splitMarcaAndSupplier,
  phoneLabel,
  normalizeIPhoneModel,
  normalizeStorage,
  normalizeDisplayBrand,
} from '../phoneUtils';

describe('phoneUtils', () => {
  // ── isInternalCode ────────────────────────────────────────────────────────

  describe('isInternalCode', () => {
    it('recognizes known internal codes', () => {
      expect(isInternalCode('WNY')).toBe(true);
      expect(isInternalCode('REC')).toBe(true);
      expect(isInternalCode('ZK')).toBe(true);
      expect(isInternalCode('HEC')).toBe(true);
      expect(isInternalCode('TRAD')).toBe(true);
      expect(isInternalCode('XT')).toBe(true);
      expect(isInternalCode('B')).toBe(true);
    });

    it('is case insensitive', () => {
      expect(isInternalCode('wny')).toBe(true);
      expect(isInternalCode('hec')).toBe(true);
      expect(isInternalCode('xt')).toBe(true);
      expect(isInternalCode('Zk')).toBe(true);
    });

    it('trims whitespace', () => {
      expect(isInternalCode('  WNY  ')).toBe(true);
    });

    it('returns false for real brands', () => {
      expect(isInternalCode('Apple')).toBe(false);
      expect(isInternalCode('Samsung')).toBe(false);
      expect(isInternalCode('Google')).toBe(false);
    });

    it('returns false for undefined/empty', () => {
      expect(isInternalCode(undefined)).toBe(false);
      expect(isInternalCode('')).toBe(false);
    });
  });

  // ── splitMarcaAndSupplier ─────────────────────────────────────────────────

  describe('splitMarcaAndSupplier', () => {
    it('maps WNY to Apple with supplier code', () => {
      const result = splitMarcaAndSupplier('WNY', 'iPhone 14 Pro');
      expect(result).toEqual({ marca: 'Apple', supplierCode: 'WNY' });
    });

    it('keeps Samsung as marca with no supplier code', () => {
      const result = splitMarcaAndSupplier('Samsung', 'Galaxy S24');
      expect(result).toEqual({ marca: 'Samsung', supplierCode: null });
    });

    it('keeps Apple as marca with no supplier code', () => {
      const result = splitMarcaAndSupplier('Apple', 'iPhone 15');
      expect(result).toEqual({ marca: 'Apple', supplierCode: null });
    });

    it('handles empty marca → Desconocida', () => {
      expect(splitMarcaAndSupplier('', null)).toEqual({ marca: 'Desconocida', supplierCode: null });
      expect(splitMarcaAndSupplier(null, null)).toEqual({ marca: 'Desconocida', supplierCode: null });
      expect(splitMarcaAndSupplier(undefined, null)).toEqual({ marca: 'Desconocida', supplierCode: null });
    });

    it('handles multi-word supplier codes like "REC IPHONE A"', () => {
      const result = splitMarcaAndSupplier('REC IPHONE A', '');
      expect(result.supplierCode).toBe('REC');
      expect(result.marca).toBe('Apple'); // Inferred from empty modelo → default Apple
    });

    it('infers Samsung from Galaxy model', () => {
      const result = splitMarcaAndSupplier('WNY', 'Galaxy S24 Ultra');
      expect(result).toEqual({ marca: 'Samsung', supplierCode: 'WNY' });
    });

    it('defaults to Apple when modelo is empty and code is internal', () => {
      const result = splitMarcaAndSupplier('hec', '');
      expect(result).toEqual({ marca: 'Apple', supplierCode: 'HEC' });
    });
  });

  // ── phoneLabel ────────────────────────────────────────────────────────────

  describe('phoneLabel', () => {
    it('returns normalized model for internal codes', () => {
      const label = phoneLabel('WNY', '14 Pro Max 128GB');
      expect(label).toBe('14 Pro Max 128GB');
    });

    it('returns "Brand Model" for real brands', () => {
      expect(phoneLabel('Samsung', 'Galaxy S24')).toBe('Samsung Galaxy S24');
    });

    it('handles empty marca', () => {
      const label = phoneLabel('', '14 Pro Max');
      expect(label).toBe('14 Pro Max');
    });

    it('handles undefined inputs', () => {
      expect(phoneLabel(undefined, undefined)).toBe('');
    });
  });

  // ── normalizeIPhoneModel ──────────────────────────────────────────────────

  describe('normalizeIPhoneModel', () => {
    it('normalizes casing: "14 PRO MAX 128GB" → "14 Pro Max 128GB"', () => {
      expect(normalizeIPhoneModel('14 PRO MAX 128GB')).toBe('14 Pro Max 128GB');
    });

    it('normalizes lowercase: "13 pro 128gb" → "13 Pro 128GB"', () => {
      expect(normalizeIPhoneModel('13 pro 128gb')).toBe('13 Pro 128GB');
    });

    it('strips "iPhone" prefix: "iPhone 14 Pro Max 128GB" → "14 Pro Max 128GB"', () => {
      expect(normalizeIPhoneModel('iPhone 14 Pro Max 128GB')).toBe('14 Pro Max 128GB');
    });

    it('strips "Apple" prefix: "Apple 14 Pro Max 128GB" → "14 Pro Max 128GB"', () => {
      expect(normalizeIPhoneModel('Apple 14 Pro Max 128GB')).toBe('14 Pro Max 128GB');
    });

    it('passes iPads through unchanged', () => {
      const input = 'IPAD 11 128GB';
      expect(normalizeIPhoneModel(input)).toBe(input);
    });

    it('handles Plus variant', () => {
      expect(normalizeIPhoneModel('15 plus 256gb')).toBe('15 Plus 256GB');
    });

    it('handles Mini variant', () => {
      expect(normalizeIPhoneModel('13 mini 128gb')).toBe('13 Mini 128GB');
    });

    it('handles SE models', () => {
      const result = normalizeIPhoneModel('SE 3 64gb');
      expect(result).toContain('SE');
      expect(result).toContain('64GB');
    });

    it('returns empty string for undefined/empty', () => {
      expect(normalizeIPhoneModel(undefined)).toBe('');
      expect(normalizeIPhoneModel('')).toBe('');
      expect(normalizeIPhoneModel('  ')).toBe('');
    });

    it('handles model without known generation but with known terms', () => {
      // Unknown generation but has "pro max" → just fix casing
      const result = normalizeIPhoneModel('something pro max 256gb');
      expect(result).toContain('Pro Max');
      expect(result).toContain('256GB');
    });
  });

  // ── normalizeStorage ──────────────────────────────────────────────────────

  describe('normalizeStorage', () => {
    it('normalizes "128 GB" → "128GB"', () => {
      expect(normalizeStorage('128 GB')).toBe('128GB');
    });

    it('normalizes "1 TB" → "1TB"', () => {
      expect(normalizeStorage('1 TB')).toBe('1TB');
    });

    it('uppercases "128gb" → "128GB"', () => {
      expect(normalizeStorage('128gb')).toBe('128GB');
    });

    it('returns "Unknown" for null/undefined', () => {
      expect(normalizeStorage(null)).toBe('Unknown');
      expect(normalizeStorage(undefined)).toBe('Unknown');
    });

    it('returns "Unknown" for empty string', () => {
      expect(normalizeStorage('')).toBe('Unknown');
    });
  });

  // ── normalizeDisplayBrand ─────────────────────────────────────────────────

  describe('normalizeDisplayBrand', () => {
    it('maps internal codes to Apple', () => {
      expect(normalizeDisplayBrand('WNY')).toBe('Apple');
      expect(normalizeDisplayBrand('REC')).toBe('Apple');
      expect(normalizeDisplayBrand('ZK')).toBe('Apple');
      expect(normalizeDisplayBrand('hec')).toBe('Apple');
      expect(normalizeDisplayBrand('xt')).toBe('Apple');
    });

    it('maps multi-word supplier codes to Apple', () => {
      expect(normalizeDisplayBrand('REC IPHONE A')).toBe('Apple');
      expect(normalizeDisplayBrand('REC Iphone')).toBe('Apple');
    });

    it('maps iPhone/Apple brand names to Apple', () => {
      expect(normalizeDisplayBrand('iPhone')).toBe('Apple');
      expect(normalizeDisplayBrand('APPLE')).toBe('Apple');
      expect(normalizeDisplayBrand('Apple')).toBe('Apple');
    });

    it('maps model-as-brand like "12 64gb" to Apple', () => {
      expect(normalizeDisplayBrand('12 64gb')).toBe('Apple');
      expect(normalizeDisplayBrand('16 PLUS 128GB')).toBe('Apple');
    });

    it('maps Samsung correctly', () => {
      expect(normalizeDisplayBrand('Samsung')).toBe('Samsung');
      expect(normalizeDisplayBrand('SAMSUNG')).toBe('Samsung');
      expect(normalizeDisplayBrand('Samsung Galaxy')).toBe('Samsung');
    });

    it('maps Samsung model-as-brand', () => {
      expect(normalizeDisplayBrand('S22 ultra')).toBe('Samsung');
      expect(normalizeDisplayBrand('s24 ultra 256gb')).toBe('Samsung');
    });

    it('returns "Otro" for undefined/empty', () => {
      expect(normalizeDisplayBrand(undefined)).toBe('Otro');
      expect(normalizeDisplayBrand('')).toBe('Otro');
    });

    it('returns original string for unknown brands', () => {
      expect(normalizeDisplayBrand('Motorola')).toBe('Motorola');
      expect(normalizeDisplayBrand('Google')).toBe('Google');
    });
  });
});
