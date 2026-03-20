import { saveDeviceDefinition, findByTacInPhones } from './deviceService';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../lib/firebase';

// Lazy-load the 111K-line TAC database only when needed (keeps InventoryPage chunk small)
let tacDbPromise: Promise<Record<string, { brand: string; model: string }>> | null = null;
function getTacDatabase() {
  if (!tacDbPromise) {
    tacDbPromise = import('../../../data/tacCatalog').then((m) => m.TAC_DATABASE);
  }
  return tacDbPromise;
}

// Strategy: 1) Offline TAC DB → 2) Own phone inventory → 3) Cloud Function (server-side Bing, no CORS)

export const fetchDeviceFromProxy = async (
  imei: string
): Promise<{ brand: string; model: string; storage?: string } | null> => {
  // Normalize GS1 artifact: scanners may prepend '1' on 16-digit GS1-128 barcodes
  const digits = imei.replace(/\D/g, '');
  const normalized = digits.length === 16 && digits[0] === '1' ? digits.slice(1) : digits;
  const uniqueTac = normalized.substring(0, 8);

  // 1. Check Offline TAC Database (Instant after first load)
  const TAC_DATABASE = await getTacDatabase();
  if (TAC_DATABASE[uniqueTac]) {
    const entry = TAC_DATABASE[uniqueTac];
    saveDeviceDefinition(uniqueTac, entry.brand, entry.model);
    return { brand: entry.brand, model: entry.model };
  }

  // 2. Check existing phone inventory (TAC prefix range query)
  const fromInventory = await findByTacInPhones(uniqueTac);
  if (fromInventory) {
    saveDeviceDefinition(uniqueTac, fromInventory.brand, fromInventory.model);
    return { brand: fromInventory.brand, model: fromInventory.model };
  }

  // 3. Cloud Function — server-side Bing search (no CORS issues)
  try {
    const lookupTacFn = httpsCallable<{ tac: string }, { brand: string; model: string } | null>(
      functions,
      'lookupTac'
    );
    const result = await lookupTacFn({ tac: uniqueTac });
    if (result.data) {
      const { brand, model } = result.data;
      saveDeviceDefinition(uniqueTac, brand, model);
      return { brand, model };
    }
  } catch {
    // Cloud Function unavailable — silent fail
  }

  return null;
};
