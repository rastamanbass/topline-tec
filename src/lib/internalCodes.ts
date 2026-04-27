/**
 * Internal Supplier Codes — registry centralizado.
 *
 * Eduardo's procurement source codes (NOT brand names — all represent iPhone
 * suppliers). Hardcoded baseline + dynamic codes added at runtime via the
 * Firestore `internal_codes` collection.
 *
 * Una vez agregado en Firestore, el codigo es compartido para todos los
 * usuarios de la app en tiempo real (onSnapshot).
 */

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

// Re-export pure data from internalCodesData (no Firebase, safe en tests/scripts).
export { HARDCODED_CODES } from './internalCodesData';
import { HARDCODED_SET } from './internalCodesData';

export type SupplierCode = string;

let mergedCache: Set<string> = new Set(HARDCODED_SET);
let firestoreCache: Set<string> = new Set();

// Registered listeners (refcounted single Firestore subscription).
const listeners = new Set<(codes: string[]) => void>();
let unsubscribeFirestore: (() => void) | null = null;

function rebuildMergedCache() {
  const merged = new Set<string>(HARDCODED_SET);
  for (const c of firestoreCache) merged.add(c);
  mergedCache = merged;
}

function notify() {
  const sorted = Array.from(mergedCache).sort();
  for (const cb of listeners) cb(sorted);
}

function ensureFirestoreSubscription() {
  if (unsubscribeFirestore) return;

  const colRef = collection(db, 'internal_codes');
  unsubscribeFirestore = onSnapshot(
    colRef,
    (snap) => {
      const next = new Set<string>();
      snap.forEach((d) => {
        const id = (d.id || '').trim().toUpperCase();
        if (id) next.add(id);
        const data = d.data() as { code?: string } | undefined;
        const codeField = data?.code?.trim()?.toUpperCase();
        if (codeField) next.add(codeField);
      });
      firestoreCache = next;
      rebuildMergedCache();
      notify();
    },
    (err) => {
      // Permisos / red — degradamos a hardcoded silenciosamente.
      console.warn('[internalCodes] onSnapshot error:', err);
    }
  );
}

function teardownFirestoreSubscriptionIfIdle() {
  if (listeners.size === 0 && unsubscribeFirestore) {
    unsubscribeFirestore();
    unsubscribeFirestore = null;
  }
}

/**
 * Subscribe to the merged internal codes list (hardcoded + Firestore).
 * Llama al callback inmediatamente con el set actual y luego cada vez que cambie.
 * Retorna funcion de unsubscribe.
 */
export function subscribeInternalCodes(callback: (codes: string[]) => void): () => void {
  listeners.add(callback);
  ensureFirestoreSubscription();
  // Push initial value (hardcoded baseline + whatever cache we already have)
  callback(Array.from(mergedCache).sort());
  return () => {
    listeners.delete(callback);
    teardownFirestoreSubscriptionIfIdle();
  };
}

/**
 * Add a new supplier code to Firestore. Idempotent (merge:true).
 * El codigo se normaliza a uppercase y trim.
 */
export async function addInternalCode(code: string, notes?: string): Promise<void> {
  const normalized = (code || '').trim().toUpperCase();
  if (!normalized) {
    throw new Error('Codigo de proveedor vacio');
  }
  // Validar formato basico — letras/numeros, 1-12 chars.
  if (!/^[A-Z0-9]{1,12}$/.test(normalized)) {
    throw new Error(`Codigo invalido: "${code}". Solo letras/numeros, 1-12 caracteres.`);
  }

  const ref = doc(db, 'internal_codes', normalized);
  const addedBy = auth.currentUser?.email ?? auth.currentUser?.uid ?? 'unknown';

  await setDoc(
    ref,
    {
      code: normalized,
      addedBy,
      addedAt: serverTimestamp(),
      notes: notes ?? '',
    },
    { merge: true }
  );

  // Optimistic local update — el onSnapshot tambien lo aplicara, pero asi
  // el caller no espera un round-trip.
  firestoreCache.add(normalized);
  rebuildMergedCache();
  notify();
}

/**
 * Synchronous lookup against the in-memory merged cache.
 * Si todavia no se ha suscrito nadie, solo conoce los hardcoded.
 */
export function isInternalCodeSync(code: string | undefined | null): boolean {
  if (!code) return false;
  return mergedCache.has(code.trim().toUpperCase());
}

/**
 * Snapshot del set actual (no reactivo).
 */
export function getKnownInternalCodes(): string[] {
  return Array.from(mergedCache).sort();
}

// ── React hook ───────────────────────────────────────────────────────────────

/**
 * Hook reactivo: retorna la lista actual de codigos (hardcoded + Firestore).
 */
export function useInternalCodes(): string[] {
  const [codes, setCodes] = useState<string[]>(() => Array.from(mergedCache).sort());

  useEffect(() => {
    const unsub = subscribeInternalCodes(setCodes);
    return unsub;
  }, []);

  return codes;
}
