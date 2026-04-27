/**
 * Pure data tests — no Firebase, no React. Sanity check de la lista canonica.
 */
import { describe, it, expect } from 'vitest';
import { HARDCODED_CODES, HARDCODED_SET } from '../internalCodesData';

describe('HARDCODED_CODES (lista canonica de supplier codes)', () => {
  it('contiene los 27 codigos esperados', () => {
    expect(HARDCODED_CODES).toHaveLength(27);
  });

  it('incluye los codigos de alto volumen de produccion', () => {
    expect(HARDCODED_CODES).toContain('WNY'); // 485 phones
    expect(HARDCODED_CODES).toContain('REC'); // 434
    expect(HARDCODED_CODES).toContain('ZK'); // 345
    expect(HARDCODED_CODES).toContain('TRAD'); // 209
    expect(HARDCODED_CODES).toContain('HEC'); // 179
    expect(HARDCODED_CODES).toContain('XT'); // 108
  });

  it('incluye los codigos nuevos confirmados con Daniel (2026-04-27)', () => {
    expect(HARDCODED_CODES).toContain('KRA');
    expect(HARDCODED_CODES).toContain('TPM');
    expect(HARDCODED_CODES).toContain('PA');
    expect(HARDCODED_CODES).toContain('LOLO');
    expect(HARDCODED_CODES).toContain('CESFL');
  });

  it('NO incluye KRAN (mergeado a KRA)', () => {
    expect(HARDCODED_CODES).not.toContain('KRAN');
  });

  it('NO incluye RQM5006653 (es nº de invoice, no proveedor)', () => {
    expect(HARDCODED_CODES).not.toContain('RQM5006653');
  });

  it('NO incluye marcas reales', () => {
    expect(HARDCODED_CODES).not.toContain('Apple');
    expect(HARDCODED_CODES).not.toContain('APPLE');
    expect(HARDCODED_CODES).not.toContain('Samsung');
    expect(HARDCODED_CODES).not.toContain('SAMSUNG');
  });

  it('todos los codigos son uppercase', () => {
    HARDCODED_CODES.forEach((code) => {
      expect(code).toBe(code.toUpperCase());
    });
  });

  it('no hay duplicados', () => {
    const unique = new Set(HARDCODED_CODES);
    expect(unique.size).toBe(HARDCODED_CODES.length);
  });

  it('todos cumplen el formato A-Z 0-9 de 1-12 chars', () => {
    HARDCODED_CODES.forEach((code) => {
      expect(code).toMatch(/^[A-Z0-9]{1,12}$/);
    });
  });
});

describe('HARDCODED_SET (uppercase Set para lookup O(1))', () => {
  it('tiene mismo size que HARDCODED_CODES', () => {
    expect(HARDCODED_SET.size).toBe(HARDCODED_CODES.length);
  });

  it('lookup case-insensitive funciona via toUpperCase', () => {
    expect(HARDCODED_SET.has('wny'.toUpperCase())).toBe(true);
    expect(HARDCODED_SET.has('KRA')).toBe(true);
    expect(HARDCODED_SET.has('UNKNOWN')).toBe(false);
  });
});
