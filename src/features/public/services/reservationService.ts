import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { Phone } from '../../../types';
import { v4 as uuidv4 } from 'uuid';

const RESERVATION_Duration_MINUTES = 30;

// Helper to get or create Session ID
export const getSessionId = (): string => {
  let sessionId = localStorage.getItem('wholesale_session_id');
  if (!sessionId) {
    sessionId = uuidv4();
    localStorage.setItem('wholesale_session_id', sessionId);
  }
  return sessionId;
};

export const reservationService = {
  // Attempt to lock a phone
  reservePhone: async (phoneId: string, sessionId: string, customerName?: string) => {
    const phoneRef = doc(db, 'phones', phoneId);

    try {
      await runTransaction(db, async (transaction) => {
        const phoneDoc = await transaction.get(phoneRef);
        if (!phoneDoc.exists()) {
          throw new Error('Phone does not exist');
        }

        const phoneData = phoneDoc.data() as Phone;
        const now = Date.now();

        // Check if already reserved by someone else and NOT expired
        // Lazy Release Logic: If expired, treat as free.
        const currentReservation = phoneData.reservation;
        const isReservedByOther =
          currentReservation &&
          currentReservation.reservedBy !== sessionId &&
          currentReservation.expiresAt > now;

        if (isReservedByOther) {
          throw new Error('Phone is already reserved by another client');
        }

        // If Status is not 'En Stock' AND not 'Reserved', we can't take it
        // (e.g. if it was Sold in the meantime)
        // Actually, our status might be 'Reserved' if it was expired.
        // We should check if status is 'En Stock' OR ('Reserved' AND expired)
        // If it is 'Reserved' and VALID, we caught it in isReservedByOther.

        // So if we are here, it is either free, or expired-reserved, or reserved-by-me.
        // But what if it's 'Sold'?
        if (
          phoneData.estado !== 'En Stock (Disponible para Venta)' &&
          phoneData.estado !== 'Apartado'
        ) {
          throw new Error('Phone is not available');
        }

        // Prepare new reservation
        const expiresAt = now + RESERVATION_Duration_MINUTES * 60 * 1000;

        transaction.update(phoneRef, {
          estado: 'Apartado', // Visual "Reserved" status
          reservation: {
            reservedBy: sessionId,
            reservedAt: now,
            expiresAt: expiresAt,
            customerName: customerName || 'Anónimo',
          },
          updatedAt: serverTimestamp(),
        });
      });
      return { success: true };
    } catch (error) {
      console.error('Reservation failed:', error);
      throw error;
    }
  },

  // Release a phone (User unchecks it)
  releasePhone: async (phoneId: string, sessionId: string) => {
    const phoneRef = doc(db, 'phones', phoneId);

    try {
      await runTransaction(db, async (transaction) => {
        const phoneDoc = await transaction.get(phoneRef);
        if (!phoneDoc.exists()) throw new Error('Phone does not exist');

        const phoneData = phoneDoc.data() as Phone;

        // Only allow release if I own it
        if (phoneData.reservation?.reservedBy !== sessionId) {
          throw new Error('You do not own this reservation');
        }

        transaction.update(phoneRef, {
          estado: 'En Stock (Disponible para Venta)',
          reservation: null,
          updatedAt: serverTimestamp(),
        });
      });
      return { success: true };
    } catch (error) {
      console.error('Release failed:', error);
      throw error;
    }
  },
};
