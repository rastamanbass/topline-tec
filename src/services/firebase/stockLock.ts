import { runTransaction, doc } from 'firebase/firestore';
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

      const reservationExpired = reservation != null && reservation.expiresAt < now;
      const isMyReservation = reservation?.reservedBy === 'POS_SALE';

      const isAvailable =
        estado === 'En Stock (Disponible para Venta)' || reservationExpired || isMyReservation;

      if (!isAvailable) {
        const marca = (data.marca as string) || '';
        const modelo = (data.modelo as string) || '';
        const info = phoneLabel(marca, modelo) || phoneDoc.id;
        throw new Error(`"${info}" ya está reservado o no disponible.`);
      }

      // Guard B2B: aunque el teléfono aparezca "En Stock", si tiene una reserva B2B
      // activa y no expirada (race condition de actualización de estado), no permitir
      // que el POS lo bloquee encima.
      const hasActiveB2BReservation =
        reservation != null &&
        reservation.reservedBy !== 'POS_SALE' &&
        !reservationExpired;

      if (hasActiveB2BReservation) {
        const marca = (data.marca as string) || '';
        const modelo = (data.modelo as string) || '';
        const info = phoneLabel(marca, modelo) || phoneDoc.id;
        const expireTime = new Date(reservation!.expiresAt).toLocaleTimeString('es-SV');
        throw new Error(
          `"${info}" está reservado por un comprador online hasta las ${expireTime}. ` +
          `No se puede bloquear para venta en POS.`
        );
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
 *
 * Seguridad: usa runTransaction individual por teléfono para verificar que la
 * reserva sigue siendo de POS antes de borrarla. Esto previene que una
 * cancelación de POS borre una reserva B2B válida que llegó después.
 *
 * Idempotente: llamar dos veces no causa problemas (si ya no hay reserva POS,
 * simplemente no hace nada).
 */
export async function unlockPhonesFromPOS(phoneIds: string[]): Promise<void> {
  if (phoneIds.length === 0) return;

  await Promise.all(
    phoneIds.map(async (id) => {
      const ref = doc(db, 'phones', id);
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists()) return; // El teléfono ya no existe — no hay nada que hacer

        const data = snap.data();
        const reservation = data.reservation as
          | { reservedBy: string; expiresAt: number }
          | null
          | undefined;

        // Solo liberar si TODAVÍA es nuestra reserva POS.
        // Si ya tiene una reserva B2B activa (llegó después de que iniciáramos el POS),
        // NO tocarla — sería borrar una reserva de un cliente legítimo.
        if (reservation?.reservedBy === 'POS_SALE') {
          transaction.update(ref, {
            reservation: null,
            estado: 'En Stock (Disponible para Venta)',
          });
        }
        // En cualquier otro caso (sin reserva, o reserva B2B): no hacer nada.
      });
    })
  );
}
