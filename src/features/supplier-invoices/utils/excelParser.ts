/**
 * Excel Parser
 * Reads .xlsx / .xls / .csv files and returns a structured ParsedSheet.
 * Uses the 'xlsx' library (SheetJS) which is already installed.
 */

import * as XLSX from 'xlsx';

export interface ParsedSheet {
  /** The detected header row values */
  headers: string[];
  /** 0-indexed row number of the header row */
  headerRowIndex: number;
  /** Data rows as key-value objects using header names as keys */
  rows: Record<string, unknown>[];
  /** Raw 2-D array of all rows (for fallback / debugging) */
  rawRows: unknown[][];
  /** The name of the sheet that was parsed */
  sheetName: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Returns true when a value is a non-empty string (not purely numeric).
 * Used to distinguish header rows from data rows.
 */
function isStringCell(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'number') return false;
  const s = String(v).trim();
  if (s === '') return false;
  if (/^\d+(\.\d+)?$/.test(s)) return false; // pure number string
  return true;
}

/**
 * Score a row as a potential header row.
 * Returns a number 0..1 representing the fraction of non-empty string cells.
 */
function headerScore(row: unknown[]): number {
  if (!row || row.length === 0) return 0;
  const nonEmpty = row.filter((v) => v != null && v !== '');
  if (nonEmpty.length === 0) return 0;
  const stringCells = nonEmpty.filter(isStringCell).length;
  return stringCells / nonEmpty.length;
}

/**
 * Find the most likely header row index (0-indexed) by scanning the first 10 rows.
 * We choose the first row whose string-cell fraction exceeds 50%.
 */
function findHeaderRowIndex(rawRows: unknown[][]): number {
  for (let i = 0; i < Math.min(10, rawRows.length); i++) {
    if (headerScore(rawRows[i]) > 0.5) return i;
  }
  // Fallback: row 0
  return 0;
}

/**
 * Convert a raw 2D row into a Record using the header array as keys.
 * If a cell is a number that looks like an IMEI (14-15 digits), converts to string.
 */
function rowToRecord(
  row: unknown[],
  headers: string[]
): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  headers.forEach((header, i) => {
    if (!header) return;
    let value = row[i];
    // Excel stores large numbers (like IMEIs) as floats — convert to string
    if (typeof value === 'number') {
      const fixed = value.toFixed(0);
      if (fixed.length >= 14 && fixed.length <= 16) {
        value = fixed; // potential IMEI
      }
    }
    record[header] = value;
  });
  return record;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Parse an uploaded Excel / CSV file.
 * Returns a ParsedSheet with detected headers and structured rows.
 */
export async function parseExcelFile(file: File): Promise<ParsedSheet> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) throw new Error('Failed to read file');

        const workbook = XLSX.read(data, {
          type: 'array',
          cellDates: false,
          // Keep raw numbers — we handle IMEI conversion ourselves
          raw: false,
        });

        const sheetName = workbook.SheetNames[0];
        if (!sheetName) throw new Error('No sheets found in workbook');

        const worksheet = workbook.Sheets[sheetName];

        // Convert sheet to 2D array
        const rawRows: unknown[][] = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: null,
          raw: true, // keep raw numeric values
        }) as unknown[][];

        if (rawRows.length === 0) {
          throw new Error('Sheet is empty');
        }

        // Detect header row
        const headerRowIndex = findHeaderRowIndex(rawRows);
        const headerRow = rawRows[headerRowIndex];

        // Build clean header list (stringify each header cell)
        const headers = headerRow.map((h) =>
          h != null ? String(h).trim() : ''
        );

        // Build data rows (everything after the header row)
        const dataRows = rawRows.slice(headerRowIndex + 1).filter((row) => {
          // Skip empty rows
          return row.some((v) => v != null && v !== '');
        });

        const rows = dataRows.map((row) => rowToRecord(row, headers));

        resolve({
          headers,
          headerRowIndex,
          rows,
          rawRows,
          sheetName,
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));

    reader.readAsArrayBuffer(file);
  });
}
