import { useEffect } from 'react';
import { getToken } from 'firebase/messaging';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context';
import { messaging, db } from '../lib/firebase';

/**
 * Requests push notification permission for buyers and saves the FCM token to Firestore.
 * Only activates for users with role 'comprador'. Safe to call for all roles — no-op otherwise.
 *
 * Prerequisites:
 *   - VITE_FIREBASE_VAPID_KEY must be set in .env.local / .env.production
 *   - public/firebase-messaging-sw.js must be deployed
 */
export function usePushNotifications() {
  const { user, userRole } = useAuth();

  useEffect(() => {
    if (!user || userRole !== 'comprador' || !messaging) return;
    if (typeof window === 'undefined') return;
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
    if (!vapidKey) {
      console.warn('[Push] VITE_FIREBASE_VAPID_KEY no configurado — saltando push notifications');
      return;
    }

    async function requestAndSaveToken() {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const token = await getToken(messaging!, { vapidKey });
        if (!token) return;

        // Only write to Firestore if token changed
        const userRef = doc(db, 'users', user!.uid);
        const snap = await getDoc(userRef);
        const existing = snap.data()?.fcmToken as string | undefined;

        if (existing !== token) {
          await updateDoc(userRef, { fcmToken: token });
        }
      } catch (err) {
        // Silently ignore — push is a nice-to-have, not critical
        console.warn('[Push] Error registrando token:', err);
      }
    }

    requestAndSaveToken();
  }, [user, userRole]);
}
