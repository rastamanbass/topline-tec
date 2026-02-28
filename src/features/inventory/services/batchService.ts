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

export const getBatches = async (): Promise<Batch[]> => {
  const batchesRef = collection(db, 'batches');
  const q = query(batchesRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Batch);
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
  const docRef = doc(db, 'batches', id);
  await deleteDoc(docRef);
};
