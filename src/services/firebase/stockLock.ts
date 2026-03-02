import { runTransaction, doc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { phoneLabel } from '../../lib/phoneUtils';

const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Atomically reserves phones for a POS sale.
 * Throws an error with a user-friendly message if any phone is unavailable.
 */
export async function lockPhonesForPOS(phoneIds: string[]): Promise<void> {
  if (phoneIds.length === 0) return;

  const now = Date.now();
  const expiresAt = now + LOCK_DURATION_MS;
  const userEmail = auth.currentUser?.email || 'POS';

  await runTransaction(db, async (transaction) => {
    // Read all phones first (all reads before writes — Firestore requirement)
    const phoneDocs = await Promise.all(
      phoneIds.map((id) => transaction.get(doc(db, 'phones', id)))
    );

    // Verify availability of all phones
    for (const phoneDoc of phoneDocs) {
      if (!phoneDoc.exists()) {
        throw new Error(`Teléfono ${phoneDoc.id} no encontrado en inventario.`);
      }
      const data = phoneDoc.data();
      const estado = data.estado as string;
      const reservation = data.reservation as
        | {
            reservedBy: string;
            expiresAt: number;
          }
        | null
        | undefined;

      const reservationExpired = reservation && reservation.expiresAt < now;
      const isMyReservation = reservation?.reservedBy === 'POS_SALE';

      const isAvailable =
        estado === 'En Stock (Disponible para Venta)' || reservationExpired || isMyReservation;

      if (!isAvailable) {
        const marca = (data.marca as string) || '';
        const modelo = (data.modelo as string) || '';
        const info = phoneLabel(marca, modelo) || phoneDoc.id;
        throw new Error(`"${info}" ya está reservado o no disponible.`);
      }
    }

    // Reserve all phones (write phase)
    for (const phoneDoc of phoneDocs) {
      transaction.update(doc(db, 'phones', phoneDoc.id), {
        reservation: {
          reservedBy: 'POS_SALE',
          reservedAt: now,
          expiresAt,
          customerName: userEmail,
        },
      });
    }
  });
}

/**
 * Releases POS locks for the given phones.
 * Called when a POS checkout is cancelled without completing the sale.
 */
export async function unlockPhonesFromPOS(phoneIds: string[]): Promise<void> {
  if (phoneIds.length === 0) return;

  const batch = writeBatch(db);

  for (const id of phoneIds) {
    const ref = doc(db, 'phones', id);
    batch.update(ref, { reservation: null });
  }

  await batch.commit();
}
