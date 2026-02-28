import { doc, getDoc, setDoc } from 'firebase/firestore';
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
