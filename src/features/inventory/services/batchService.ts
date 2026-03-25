import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';

export interface Batch {
  id: string;
  name: string;
  createdAt: import('firebase/firestore').Timestamp | null;
  status: 'active' | 'closed';
}

/**
 * Get batches from the `batches` collection AND extract distinct lote values
 * from the `phones` collection so Eduardo sees existing lots.
 */
export const getBatches = async (): Promise<Batch[]> => {
  // 1. Get explicitly created batches
  const batchesRef = collection(db, 'batches');
  const batchQ = query(batchesRef, orderBy('createdAt', 'desc'));
  const batchSnap = await getDocs(batchQ);
  const explicit = batchSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Batch);
  const explicitNames = new Set(explicit.map((b) => b.name));

  // 2. Extract distinct lote values from phones
  const phonesSnap = await getDocs(collection(db, 'phones'));
  const loteSet = new Set<string>();
  phonesSnap.docs.forEach((d) => {
    const lote = d.data().lote;
    if (lote && typeof lote === 'string' && lote.trim() && !explicitNames.has(lote)) {
      loteSet.add(lote.trim());
    }
  });

  // 3. Merge: explicit batches first, then discovered lotes
  const discovered: Batch[] = Array.from(loteSet)
    .sort()
    .map((name) => ({
      id: `phone-lote-${name}`,
      name,
      createdAt: null,
      status: 'active' as const,
    }));

  return [...explicit, ...discovered];
};

export const createBatch = async (name: string) => {
  const batchesRef = collection(db, 'batches');
  await addDoc(batchesRef, {
    name,
    status: 'active',
    createdAt: serverTimestamp(),
  });
};

export const deleteBatch = async (id: string) => {
  // Only delete from batches collection, not phone-derived lotes
  if (id.startsWith('phone-lote-')) return;
  const docRef = doc(db, 'batches', id);
  await deleteDoc(docRef);
};
