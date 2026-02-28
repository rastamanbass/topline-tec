import axios from 'axios';
import { TAC_DATABASE } from '../../../data/tacCatalog';
import { saveDeviceDefinition } from './deviceService';

// "Multi-Engine Proxy": The MIT Solution
// Strategy: Try Bing First (Best Index) -> Fallback to DuckDuckGo (Different Index).
// Route both through corsproxy.io (Stable).

const CORS_PROXY = 'https://corsproxy.io/?';

const ENGINES = [
  { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  { name: 'DuckDuckGo', url: 'https://html.duckduckgo.com/html/?q=' },
];

export const fetchDeviceFromProxy = async (
  imei: string
): Promise<{ brand: string; model: string; storage?: string } | null> => {
  const uniqueTac = imei.substring(0, 8);

  // 1. Check Offline TAC Database (Instant, 100% Reliable)
  if (TAC_DATABASE[uniqueTac]) {
    const entry = TAC_DATABASE[uniqueTac];
    saveDeviceDefinition(uniqueTac, entry.brand, entry.model);
    return { brand: entry.brand, model: entry.model };
  }

  // 2. Online "Free" Search (Multi-Engine)
  if (imei.length < 8) return null;

  // Helper to parse HTML for brands
  const parseHtmlForDevice = (html: string): { brand: string; model: string } | null => {
    const lowerHtml = html.toLowerCase();
    const brands = [
      'Apple',
      'Samsung',
      'Xiaomi',
      'Motorola',
      'Google',
      'Huawei',
      'Oppo',
      'Vivo',
      'Realme',
      'Infinix',
      'Tecno',
      'OnePlus',
      'Honor',
      'Sony',
      'LG',
    ];

    for (const brand of brands) {
      if (lowerHtml.includes(brand.toLowerCase())) {
        // Regex to find "Brand Model" patterns
        const regex = new RegExp(`(${brand}\\s+[a-zA-Z0-9\\+\\s]{2,20})`, 'i');
        const match = html.match(regex);

        if (match && match[1]) {
          let detectedModel = match[1].trim();

          // Cleanup Garbage
          const garbage = [
            'price',
            'specs',
            'review',
            'buy',
            'imei',
            'tac',
            'check',
            'support',
            '...',
            'compare',
            'vs',
            'case',
            'cover',
            'best',
            'new',
            'release',
          ];
          for (const g of garbage) {
            if (detectedModel.toLowerCase().includes(g)) {
              detectedModel = detectedModel.replace(new RegExp(g + '.*', 'gi'), '').trim();
            }
          }

          if (
            detectedModel.length > 3 &&
            !detectedModel.includes('<') &&
            !detectedModel.includes('>')
          ) {
            return { brand: brand, model: detectedModel };
          }
        }
      }
    }
    return null;
  };

  // Try Engines Sequentially
  for (const engine of ENGINES) {
    try {
      const query = `TAC ${uniqueTac} phone model gsma`;
      const targetUrl = `${engine.url}${encodeURIComponent(query)}`;
      const proxyUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;

      // Fast timeout to keep UI snappy
      const response = await axios.get(proxyUrl, { timeout: 3500 });
      const result = parseHtmlForDevice(response.data);

      if (result) {
        saveDeviceDefinition(uniqueTac, result.brand, result.model);
        return result; // Found it! Return immediately.
      }
    } catch {
      // Continue to next engine if this one fails/times out
      // Suppress errors to avoid console noise
    }
  }

  return null; // All engines failed
};
