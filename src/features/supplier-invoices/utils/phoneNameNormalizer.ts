/**
 * Phone Name Normalizer
 * Parses raw product description strings from supplier invoices into structured fields.
 */

export interface NormalizedPhone {
  marca?: string;
  modelo?: string;
  storage?: string;
  carrier?: string;
  type: 'phone' | 'accessory' | 'part';
}

// ── Keyword lists ─────────────────────────────────────────────────────────────

const ACCESSORY_KEYWORDS = [
  'assembly',
  'battery',
  'lcd',
  'oled',
  'screen',
  'flex',
  'cable',
  'charger',
  'case',
  'tag',
  'sticker',
  'adapter',
  'tempered glass',
  'glass',
  'folio',
  'cover',
  'grip',
  'stand',
  'wireless',
  'dock',
  'hub',
  'lens',
  'housing',
  'frame',
  'speaker',
  'microphone',
  'vibrator',
  'connector',
  'port',
  'board',
  'chip',
  'ic',
  'bracket',
  'screw',
  'adhesive',
];

const PART_KEYWORDS = [
  'repair stock',
  'for parts',
  'broken',
  'cracked',
  'damaged',
  'faulty',
  'defective',
];

const CARRIER_KEYWORDS: Record<string, string> = {
  unlocked: 'Unlocked',
  'att': 'AT&T',
  'at&t': 'AT&T',
  verizon: 'Verizon',
  'tmobile': 'T-Mobile',
  't-mobile': 'T-Mobile',
  sprint: 'Sprint',
  boost: 'Boost',
  cricket: 'Cricket',
  metro: 'Metro PCS',
  'us cellular': 'US Cellular',
};

// ── Brand patterns ────────────────────────────────────────────────────────────

interface BrandRule {
  pattern: RegExp;
  brandName: string;
  modelPrefix?: string; // e.g. "iPhone" for Apple
  modelPattern?: RegExp; // e.g. captures "14 Pro Max"
}

const BRAND_RULES: BrandRule[] = [
  {
    // "APPLE IPHONE 14 PRO MAX 128GB ..."
    // "Apple iPhone 11 64GB Repair Stock"
    pattern: /\bapple\s+iphone\b/i,
    brandName: 'Apple',
    modelPrefix: 'iPhone',
    modelPattern:
      /\biphone\s+([\d]+(?:\s+(?:pro\s+max|pro|plus|mini|max))?)/i,
  },
  {
    // "APPLE IPAD ..."
    pattern: /\bapple\s+ipad\b/i,
    brandName: 'Apple',
    modelPrefix: 'iPad',
    modelPattern: /\bipad\s+(\w+(?:\s+\w+)?)/i,
  },
  {
    // "Samsung S22 Ultra 5G 128GB Unlocked"
    // "SAMSUNG GALAXY S23 ULTRA 256GB"
    pattern: /\bsamsung\b/i,
    brandName: 'Samsung',
    modelPattern:
      /\bsamsung\s+(?:galaxy\s+)?([\w\d]+(?:\s+(?:ultra|plus|\+|fe|5g|4g))*)/i,
  },
  {
    // "Google Pixel 7 Pro 128GB"
    pattern: /\bgoogle\s+pixel\b/i,
    brandName: 'Google',
    modelPrefix: 'Pixel',
    modelPattern: /\bpixel\s+([\d]+(?:\s+(?:pro|xl|a))?)/i,
  },
  {
    // "OnePlus 11 256GB"
    pattern: /\boneplus\b/i,
    brandName: 'OnePlus',
    modelPattern: /\boneplus\s+(\w+(?:\s+\w+)?)/i,
  },
  {
    // "Motorola Moto G ..."
    pattern: /\bmotorola\b/i,
    brandName: 'Motorola',
    modelPattern: /\bmotorola\s+(?:moto\s+)?([\w\d]+(?:\s+\w+)?)/i,
  },
  {
    // "LG G8 ThinQ ..."
    pattern: /\blg\b/i,
    brandName: 'LG',
    modelPattern: /\blg\s+([\w\d]+(?:\s+\w+)?)/i,
  },
];

// ── Storage pattern ───────────────────────────────────────────────────────────

const STORAGE_PATTERN = /\b(\d+(?:\.\d+)?)\s*(GB|TB|MB)\b/i;

// ── Helpers ───────────────────────────────────────────────────────────────────

function containsAny(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw));
}

function extractStorage(text: string): string | undefined {
  const match = text.match(STORAGE_PATTERN);
  if (!match) return undefined;
  return `${match[1]}${match[2].toUpperCase()}`;
}

function extractCarrier(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [kw, canonical] of Object.entries(CARRIER_KEYWORDS)) {
    if (lower.includes(kw)) return canonical;
  }
  return undefined;
}

function titleCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(Pro Max|Pro|Ultra|Plus|Mini|Fe|5g|4g)\b/gi, (m) =>
      m.replace(/\b\w/g, (c) => c.toUpperCase())
    );
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Parse a raw product description string from a supplier invoice into structured fields.
 *
 * Examples:
 *   "APPLE IPHONE 14 PRO MAX 128GB" → { marca: "Apple", modelo: "iPhone 14 Pro Max", storage: "128GB", type: "phone" }
 *   "OLED ASSEMBLY FOR IPHONE VARIED" → { type: "accessory" }
 *   "APPLE IPHONE 11 64GB REPAIR STOCK" → { marca: "Apple", modelo: "iPhone 11", storage: "64GB", type: "part" }
 *   "Samsung S22 Ultra 5G 128GB Unlocked" → { marca: "Samsung", modelo: "S22 Ultra 5G", storage: "128GB", carrier: "Unlocked", type: "phone" }
 */
export function normalizePhoneDescription(description: string): NormalizedPhone {
  if (!description || typeof description !== 'string') {
    return { type: 'unknown' as 'accessory' };
  }

  const text = description.trim();

  // 1. Detect accessories first (before brand matching)
  if (containsAny(text, ACCESSORY_KEYWORDS)) {
    return { type: 'accessory' };
  }

  // 2. Detect repair/part stock
  const isPart = containsAny(text, PART_KEYWORDS);

  // 3. Try brand rules
  for (const rule of BRAND_RULES) {
    if (!rule.pattern.test(text)) continue;

    const storage = extractStorage(text);
    const carrier = extractCarrier(text);

    let modelo: string | undefined;

    if (rule.modelPattern) {
      const mMatch = text.match(rule.modelPattern);
      if (mMatch) {
        let rawModel = mMatch[1].trim();
        // Remove storage from model if it leaked in
        rawModel = rawModel.replace(STORAGE_PATTERN, '').trim();
        // Remove carrier keywords from model
        for (const kw of Object.keys(CARRIER_KEYWORDS)) {
          rawModel = rawModel.replace(new RegExp('\\b' + kw + '\\b', 'i'), '').trim();
        }
        modelo = (rule.modelPrefix ? `${rule.modelPrefix} ` : '') + titleCase(rawModel);
        // Clean up double spaces
        modelo = modelo.replace(/\s+/g, ' ').trim();
      }
    }

    return {
      marca: rule.brandName,
      modelo,
      storage,
      carrier,
      type: isPart ? 'part' : 'phone',
    };
  }

  // 4. No known brand matched — if it has a storage pattern it might still be a phone
  const storage = extractStorage(text);
  if (storage) {
    return {
      storage,
      carrier: extractCarrier(text),
      type: isPart ? 'part' : 'phone',
    };
  }

  // 5. Default: unknown (treat as accessory for safety)
  return { type: 'accessory' };
}
