import { arrayUnion } from 'firebase/firestore';
import { auth } from './firebase';
import type { PhoneStatus } from '../types';

export interface HistoryEntry {
  newStatus: PhoneStatus;
  date: string; // ISO string — consistent with legacy format in usePhones.ts
  user: string;
  details?: string;
}

/**
 * Build a status history entry for arrayUnion writes.
 * Uses ISO string for date (consistent with existing entries in the codebase).
 */
export function buildHistoryEntry(newStatus: PhoneStatus, details?: string): HistoryEntry {
  return {
    newStatus,
    date: new Date().toISOString(),
    user: auth.currentUser?.email || 'unknown',
    details,
  };
}

/**
 * Returns an arrayUnion-wrapped history entry, ready to use in updateDoc.
 * Usage: updateDoc(ref, { statusHistory: historyArrayUnion(entry) })
 */
export function historyArrayUnion(entry: HistoryEntry) {
  return arrayUnion(entry);
}
