/**
 * Column Detector
 * Auto-maps Excel column headers and sample data values to our standard field names.
 */

import { looksLikeIMEI } from './imeiValidator';

export type StandardField =
  | 'imei'
  | 'make'
  | 'model'
  | 'storage'
  | 'carrier'
  | 'fullModel'
  | 'unitPrice'
  | 'qty'
  | 'boxNumber'
  | 'trackingNumber'
  | null;

// ── Header name patterns ──────────────────────────────────────────────────────

const HEADER_PATTERNS: Array<{ field: StandardField; pattern: RegExp }> = [
  { field: 'imei', pattern: /imei|serial|sn\b/i },
  { field: 'make', pattern: /make|brand|marca/i },
  { field: 'model', pattern: /^model$|^modelo$/i },
  { field: 'storage', pattern: /storage|capacity|capacidad|memory/i },
  { field: 'carrier', pattern: /carrier|network|operador|operator/i },
  {
    field: 'fullModel',
    pattern: /full.?model|descripci[oó]n|description|product.?name|nombre|item\s*(desc|name)/i,
  },
  { field: 'unitPrice', pattern: /unit.?price|precio|costo|cost|price/i },
  { field: 'qty', pattern: /^qty$|^quantity$|^cantidad$|^piezas$|^pieces$|^units$/i },
  { field: 'boxNumber', pattern: /box|caja|box.?number|box.?#/i },
  { field: 'trackingNumber', pattern: /tracking|guia|guía|track/i },
];

// ── Sample value heuristics ───────────────────────────────────────────────────

function detectFromSampleValues(sampleValues: unknown[]): StandardField {
  const nonEmpty = sampleValues.filter((v) => v != null && v !== '');
  if (nonEmpty.length === 0) return null;

  // Check for IMEI: 15-digit numbers
  const imeiCount = nonEmpty.filter((v) => looksLikeIMEI(v)).length;
  if (imeiCount / nonEmpty.length >= 0.5) return 'imei';

  // Check for storage: pattern like "128GB", "256GB"
  const storageCount = nonEmpty.filter((v) =>
    /^\d+\s*(GB|TB|MB)$/i.test(String(v).trim())
  ).length;
  if (storageCount / nonEmpty.length >= 0.5) return 'storage';

  // Check for carrier keywords
  const carrierKws = /unlocked|at&t|att|verizon|t-mobile|tmobile|sprint|cricket|boost|metro/i;
  const carrierCount = nonEmpty.filter((v) => carrierKws.test(String(v))).length;
  if (carrierCount / nonEmpty.length >= 0.5) return 'carrier';

  // Check for brand/model keywords
  const brandKws = /apple|samsung|iphone|galaxy|google|pixel|oneplus|motorola|lg/i;
  const brandCount = nonEmpty.filter((v) => brandKws.test(String(v))).length;
  if (brandCount / nonEmpty.length >= 0.5) return 'fullModel';

  // Check for numeric — could be qty or price
  const numericValues = nonEmpty
    .map((v) => parseFloat(String(v).replace(/[$,]/g, '')))
    .filter((n) => !isNaN(n));

  if (numericValues.length / nonEmpty.length >= 0.7) {
    const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
    const max = Math.max(...numericValues);
    // Quantities are typically small integers; prices can be larger
    if (max <= 200 && numericValues.every((n) => Number.isInteger(n))) return 'qty';
    if (avg >= 10 && avg <= 5000) return 'unitPrice';
  }

  return null;
}

// ── Per-column detection ──────────────────────────────────────────────────────

/**
 * Detect the standard field for a single column.
 * First tries header name matching; falls back to sample value analysis.
 */
export function detectColumnType(
  header: string,
  sampleValues: unknown[]
): StandardField {
  const trimmed = header.trim();

  // Try header-name patterns first
  for (const { field, pattern } of HEADER_PATTERNS) {
    if (pattern.test(trimmed)) return field;
  }

  // Fall back to sample value heuristics
  return detectFromSampleValues(sampleValues);
}

// ── Multi-column detection ────────────────────────────────────────────────────

/**
 * Auto-map all columns to standard fields.
 * Returns a mapping from column header → standard field name (string).
 * Unmapped columns are omitted.
 */
export function detectColumnMappings(
  headers: string[],
  sampleRows: unknown[][]
): Record<string, string> {
  const result: Record<string, string> = {};
  const assigned = new Set<StandardField>();

  headers.forEach((header, colIdx) => {
    const sampleValues = sampleRows
      .map((row) => row[colIdx])
      .filter((v) => v != null && v !== '');

    const field = detectColumnType(header, sampleValues);
    if (field && !assigned.has(field)) {
      result[header] = field;
      assigned.add(field);
    }
  });

  return result;
}

/**
 * Returns a confidence label for a detected mapping.
 * 'high'  → matched by header name
 * 'medium' → matched by sample values
 * 'none' → no match
 */
export function getConfidence(
  header: string,
  field: StandardField
): 'high' | 'medium' | 'none' {
  if (!field) return 'none';
  for (const { field: f, pattern } of HEADER_PATTERNS) {
    if (f === field && pattern.test(header.trim())) return 'high';
  }
  return 'medium';
}
