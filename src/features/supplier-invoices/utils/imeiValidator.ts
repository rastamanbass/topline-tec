/**
 * IMEI Validator — Luhn algorithm implementation
 * Validates 15-digit IMEI numbers used to identify mobile devices
 */

/**
 * Validates an IMEI string using the Luhn checksum algorithm.
 * Accepts raw strings that may contain non-digit characters (they are stripped).
 * Returns true only when the string is exactly 15 digits and passes Luhn.
 */
export function validateIMEI(imei: string): boolean {
  const cleaned = String(imei).replace(/\D/g, '');
  if (cleaned.length !== 15) return false;

  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let digit = parseInt(cleaned[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  return sum % 10 === 0;
}

/**
 * Attempts to coerce a value (number or string) to a valid 15-digit IMEI string.
 * Excel often stores IMEIs as large integers — we convert and zero-pad if needed.
 * Also handles the GS1 scanner artifact where a leading "1" is prepended to the IMEI.
 * Returns null when the value cannot be converted to a plausible IMEI.
 */
export function coerceIMEI(raw: unknown): string | null {
  if (raw == null) return null;

  // Excel stores large numbers as floats — convert to string without scientific notation
  let str: string;
  if (typeof raw === 'number') {
    str = raw.toFixed(0); // avoids "3.50139676766209e+14"
  } else {
    str = String(raw).replace(/\D/g, '');
  }

  // Zero-pad to 15 digits if the number is 14 digits (leading-zero IMEI edge case)
  if (str.length === 14) str = '0' + str;

  // GS1 barcode scanner artifact: some scanners prepend "1" to the 15-digit IMEI,
  // producing a 16-digit string. Strip the leading "1" to recover the real IMEI.
  if (str.length === 16 && str[0] === '1') str = str.slice(1);

  // Return null if not 15 digits
  if (str.length !== 15) return null;

  return str;
}

/**
 * Returns true when the raw value looks like an IMEI (15 digits after stripping).
 * Does NOT validate the Luhn checksum — use for column auto-detection.
 */
export function looksLikeIMEI(raw: unknown): boolean {
  const coerced = coerceIMEI(raw);
  return coerced !== null;
}
