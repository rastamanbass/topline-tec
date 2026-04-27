/**
 * Pure data module — no side effects, no Firebase imports.
 * Importable from anywhere (tests, server scripts, components).
 *
 * Lista canonica final confirmada con Daniel (2026-04-27).
 * KRAN → mergea a KRA (typo). RQM5006653 NO es supplier (es nº invoice).
 */
export const HARDCODED_CODES = [
  'WNY',
  'REC',
  'ZK',
  'HEC',
  'TRAD',
  'XT',
  'B',
  'RUB',
  'ANG',
  'ANGE',
  'XTRA',
  'WS',
  'EB',
  'LZ',
  'TRADE',
  'ORCA',
  'INQ',
  'JES',
  'RB',
  'HE',
  'OH',
  'OFFE',
  'KRA',
  'TPM',
  'PA',
  'LOLO',
  'CESFL',
] as const;

export const HARDCODED_SET: Set<string> = new Set(HARDCODED_CODES.map((c) => c.toUpperCase()));
