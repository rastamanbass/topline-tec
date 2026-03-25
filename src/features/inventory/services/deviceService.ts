import { doc, getDoc, setDoc, collection, query, where, limit, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export interface DeviceDefinition {
  brand: string;
  model: string;
  updatedAt: number;
}

const COLLECTION_NAME = 'device_definitions';

export const getDeviceDefinition = async (tac: string): Promise<DeviceDefinition | null> => {
  if (!tac || tac.length < 8) return null;

  try {
    const docRef = doc(db, COLLECTION_NAME, tac);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as DeviceDefinition;
    }
    return null;
  } catch (error) {
    console.error('Error fetching device definition:', error);
    return null;
  }
};

export const saveDeviceDefinition = async (
  tac: string,
  brand: string,
  model: string
): Promise<void> => {
  if (!tac || tac.length < 8 || !brand || !model) return;

  try {
    const docRef = doc(db, COLLECTION_NAME, tac);
    await setDoc(
      docRef,
      {
        brand,
        model,
        updatedAt: Date.now(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error saving device definition:', error);
  }
};

/** Seed device_definitions from all existing phones in inventory.
 *  Reads every phone, extracts the 8-digit TAC, and saves brand/model.
 *  Uses set+merge so no need to check existence first (fast). */
export const seedDeviceDefinitions = async (): Promise<number> => {
  const phonesSnap = await getDocs(collection(db, 'phones'));
  const tacMap = new Map<string, { brand: string; model: string }>();

  for (const phoneDoc of phonesSnap.docs) {
    const { imei, marca, modelo } = phoneDoc.data();
    if (!imei || !marca || !modelo) continue;

    const digits = String(imei).replace(/\D/g, '');
    const norm = digits.length === 16 && digits[0] === '1' ? digits.slice(1) : digits;
    if (norm.length < 8) continue;

    const tac = norm.substring(0, 8);
    if (!tacMap.has(tac)) {
      tacMap.set(tac, { brand: marca, model: modelo });
    }
  }

  const entries = Array.from(tacMap.entries());

  // Write in batches of 500 (Firestore limit). Uses merge to skip existence checks.
  for (let i = 0; i < entries.length; i += 500) {
    const chunk = entries.slice(i, i + 500);
    const batch = writeBatch(db);

    for (const [tac, { brand, model }] of chunk) {
      batch.set(doc(db, COLLECTION_NAME, tac), { brand, model, updatedAt: Date.now() }, { merge: true });
    }

    await batch.commit();
  }

  return entries.length;
};

/** Query existing phone inventory by TAC prefix to identify device brand/model. */
export const findByTacInPhones = async (tac: string): Promise<DeviceDefinition | null> => {
  try {
    const q = query(
      collection(db, 'phones'),
      where('imei', '>=', tac),
      where('imei', '<', tac + '\uf8ff'),
      limit(1)
    );
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0].data();
      if (d.marca && d.modelo) {
        return { brand: d.marca, model: d.modelo, updatedAt: Date.now() };
      }
    }
    return null;
  } catch {
    return null;
  }
};
