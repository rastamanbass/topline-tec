import { useMutation } from '@tanstack/react-query';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import type { ReceptionAct } from '../../../types';

/**
 * Saves a signed reception act to Firestore (receptionActs collection).
 * Returns the new document ID.
 */
export function useSaveReceptionAct() {
  return useMutation({
    mutationFn: async (actData: Omit<ReceptionAct, 'id'>) => {
      const ref = await addDoc(collection(db, 'receptionActs'), {
        ...actData,
        receivedAt: serverTimestamp(),
        receivedByEmail: auth.currentUser?.email || 'unknown',
      });
      return ref.id;
    },
  });
}
