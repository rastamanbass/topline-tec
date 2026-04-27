// Eduardo's procurement source codes — how he tracks where he bought phones.
// These are NOT brand names (all represent iPhone sources) and should never
// be displayed as brands to clients or staff.
//
// La lista canonica vive en `src/lib/internalCodes.ts` (HARDCODED_CODES) y se
// extiende dinamicamente desde la coleccion Firestore `internal_codes`. Aqui
// mantenemos un Set local sincronizado con esa fuente para compatibilidad con
// llamadores que no son React (utilidades sincronas).
import { HARDCODED_CODES } from './internalCodesData';

// Set local sincronico — no requiere Firebase. Componentes React que necesiten
// codigos agregados en runtime (Firestore) deben usar useInternalCodes() del
// modulo internalCodes.ts. Para validacion básica server-side / tests, basta esto.
const INTERNAL_CODES = new Set<string>(HARDCODED_CODES.map((c) => c.toUpperCase()));

export function isInternalCode(marca: string | undefined): boolean {
  if (!marca) return false;
  return INTERNAL_CODES.has(marca.trim().toUpperCase());
}

/**
 * Infiere la marca real del teléfono a partir del nombre del modelo.
 * Usado cuando solo tenemos un código de proveedor en `marca`.
 */
function inferBrandFromModel(modelo: string | undefined): string {
  if (!modelo) return 'Apple'; // default — todos los proveedores de Eduardo venden iPhones
  const m = modelo.toUpperCase();
  if (m.includes('IPHONE') || m.includes('IPAD')) return 'Apple';
  if (m.includes('GALAXY') || /\bS\d{2}\b/.test(m) || /\bA\d{2}\b/.test(m)) return 'Samsung';
  if (m.includes('PIXEL')) return 'Google';
  if (m.includes('ONEPLUS')) return 'OnePlus';
  if (m.includes('MOTOROLA') || m.includes('MOTO')) return 'Motorola';
  // Si hay un número de 2 dígitos al inicio (ej: "14 Pro Max"), es iPhone
  if (/^\d{2}[\s\b]/.test(m.trim())) return 'Apple';
  return 'Apple'; // default conservador — Eduardo principalmente vende iPhones
}

/**
 * Separa automáticamente una marca ingresada por Eduardo en:
 * - marca: marca real del teléfono ("Apple", "Samsung", etc.)
 * - supplierCode: código del proveedor (si aplica), siempre en uppercase
 *
 * Ejemplos:
 * - ("WNY", "iPhone 14 Pro") → { marca: "Apple", supplierCode: "WNY" }
 * - ("Samsung", "Galaxy S24") → { marca: "Samsung", supplierCode: null }
 * - ("Apple", "iPhone 15")   → { marca: "Apple", supplierCode: null }
 * - ("hec", "")              → { marca: "Apple", supplierCode: "HEC" }
 * - ("REC IPHONE A", "")     → { marca: "Apple", supplierCode: "REC" }
 */
export function splitMarcaAndSupplier(
  rawMarca: string | undefined | null,
  modelo: string | undefined | null
): { marca: string; supplierCode: string | null } {
  if (!rawMarca?.trim()) return { marca: 'Desconocida', supplierCode: null };

  const trimmed = rawMarca.trim();

  // 1. El valor completo es un código interno (ej: "WNY", "xt", "HEC")
  if (isInternalCode(trimmed)) {
    return {
      marca: inferBrandFromModel(modelo ?? undefined),
      supplierCode: trimmed.toUpperCase(),
    };
  }

  // 2. La primera palabra es un código interno (ej: "REC IPHONE A", "WNY 14 PRO")
  const firstWord = trimmed.split(/\s+/)[0];
  if (isInternalCode(firstWord)) {
    return {
      marca: inferBrandFromModel(modelo ?? undefined),
      supplierCode: firstWord.toUpperCase(),
    };
  }

  // 3. No es un código de proveedor — retornar como está
  return { marca: trimmed, supplierCode: null };
}

/**
 * Returns a clean display label for a phone.
 * For internal procurement codes, returns the normalized iPhone model string.
 * For real brands (Apple, Samsung, etc.) returns "Brand Model".
 */
export function phoneLabel(marca: string | undefined, modelo: string | undefined): string {
  const m = (marca || '').trim();
  const mod = (modelo || '').trim();
  if (!m || isInternalCode(m)) {
    // All internal codes are iPhones — normalize the model string
    return normalizeIPhoneModel(mod) || mod;
  }
  return `${m} ${mod}`.trim();
}

/**
 * Normalizes Eduardo's iPhone model strings to a consistent display format.
 * Handles casing differences and deduplicates the same model entered multiple ways.
 *
 *   "14 PRO MAX 128GB"        → "14 Pro Max 128GB"
 *   "13 pro 128gb"            → "13 Pro 128GB"
 *   "iPhone 14 Pro Max 128GB" → "14 Pro Max 128GB"  (strips iPhone/Apple prefix)
 *   "Apple 14 Pro Max 128GB"  → "14 Pro Max 128GB"  (strips Apple prefix)
 *   "IPAD 11 128GB"           → "IPAD 11 128GB"     (iPads pass through)
 */
export function normalizeIPhoneModel(modelo: string | undefined): string {
  if (!modelo) return '';
  let s = modelo.trim();
  if (!s) return '';

  // iPads and accessories pass through unchanged
  if (/\bipad\b/i.test(s)) return s;

  // Strip "iPhone " or "Apple " leading prefix (shown separately via marca)
  s = s.replace(/^(iphone|apple)\s+/i, '');

  // Identify iPhone generation: 11–17, or SE variants
  const modelMatch = s.match(/\b(1[1-7]|SE\s*\d*)\b/i);

  if (!modelMatch) {
    // Unknown generation — just fix casing of known terms
    return s
      .replace(/\bpro\s*max\b/gi, 'Pro Max')
      .replace(/\bpro\b/gi, 'Pro')
      .replace(/\bplus\b/gi, 'Plus')
      .replace(/\bmini\b/gi, 'Mini')
      .replace(/\b(\d+)\s*(gb|tb)\b/gi, (_, n, u) => `${n}${u.toUpperCase()}`);
  }

  const modelNum = modelMatch[1].trim();

  // Variant — check Pro Max before Pro to avoid mis-matching
  let variant = '';
  if (/\bpro\s*max\b/i.test(s)) variant = 'Pro Max';
  else if (/\bpro\b/i.test(s)) variant = 'Pro';
  else if (/\bplus\b/i.test(s)) variant = 'Plus';
  else if (/\bmini\b/i.test(s)) variant = 'Mini';

  // Storage (e.g. "128GB", "128gb", "128 GB", "1TB")
  const storageMatch = s.match(/\b(\d+)\s*(GB|TB)\b/i);
  const storage = storageMatch ? `${storageMatch[1]}${storageMatch[2].toUpperCase()}` : '';

  return [modelNum, variant, storage].filter(Boolean).join(' ');
}

/**
 * Returns the canonical brand name for display in analytics and UI.
 * Handles Eduardo's procurement codes, case variants, and messy manual data.
 */
export function normalizeStorage(storage: string | undefined | null): string {
  if (!storage) return 'Unknown';
  return storage.trim().toUpperCase().replace(/\s+/g, ''); // "128 GB" → "128GB", "1 TB" → "1TB"
}

export function normalizeDisplayBrand(marca: string | undefined): string {
  if (!marca) return 'Otro';
  const s = marca.trim();
  if (!s) return 'Otro';
  const u = s.toUpperCase();

  // Eduardo's procurement codes → Apple (all iPhone sources)
  if (INTERNAL_CODES.has(u)) return 'Apple';

  // First word is an internal code (e.g. "REC IPHONE A", "REC Iphone ", "REC tiene mensaje")
  const firstWord = u.split(/\s+/)[0];
  if (INTERNAL_CODES.has(firstWord)) return 'Apple';

  // Apple brand / model name variations entered as marca
  if (u.includes('IPHONE') || u.includes('APPLE')) return 'Apple';

  // iPhone model number entered as brand (e.g. "12 64gb", "16 PLUS 128GB", "11 64 gb")
  if (/^\d{2}[\s\b]/.test(s) && /\d+(GB|TB)/i.test(s)) return 'Apple';

  // Samsung — exact and case variants
  if (u === 'SAMSUNG' || u.startsWith('SAMSUNG ')) return 'Samsung';
  // Samsung Galaxy model entered as brand: "S22 ultra", "s24 ultra 256gb", "s23 ultra 256gb"
  if (/^S\d{2}/i.test(s)) return 'Samsung';

  return s;
}
