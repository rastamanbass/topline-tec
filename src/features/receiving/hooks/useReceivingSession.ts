import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  addDoc,
  serverTimestamp,
  writeBatch,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import type { Phone } from '../../../types';
import { usePhones } from '../../inventory/hooks/usePhones';
import { useQueryClient } from '@tanstack/react-query';

export type ScanStatus = 'ok' | 'duplicate' | 'wrong_state' | 'not_found';

export interface ScannedResult {
  imei: string;
  status: ScanStatus;
  phoneId?: string;
  phoneInfo?: string;
  currentState?: string;
  fullScannedImei?: string; // When partial IMEI matched, stores the real 15-digit IMEI
}

// Load lotes that currently have phones in transit — REAL-TIME via onSnapshot.
// Eduardo carga teléfono → en <2s aparece en /receiving para Marta sin refresh.
export function useTransitLotes() {
  const [phones, setPhones] = useState<Phone[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'phones'), where('estado', '==', 'En Tránsito (a El Salvador)'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Phone[] = [];
        snapshot.forEach((d) => {
          const data = d.data() as Phone;
          if (!data.seized) list.push({ ...data, id: d.id });
        });
        setPhones(list);
        setIsLoading(false);
      },
      (err) => {
        console.error('useTransitLotes onSnapshot error:', err);
        setIsLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const lotesWithCount = useMemo(() => {
    const counts = new Map<string, number>();
    phones.forEach((p) => {
      if (p.lote) counts.set(p.lote, (counts.get(p.lote) || 0) + 1);
    });
    return [...counts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, count]) => ({
        name,
        count,
        label: `${name} (${count} ${count === 1 ? 'equipo' : 'equipos'})`,
      }));
  }, [phones]);
  const lotes = useMemo(() => lotesWithCount.map((l) => l.name), [lotesWithCount]);
  return { lotes, lotesWithCount, isLoading, totalPhones: phones.length };
}

export function useReceivingSession(selectedLote: string) {
  const queryClient = useQueryClient();

  // Load all phones for this lote (client-side filter for transit state)
  const { data: allLotePhones = [], isLoading } = usePhones(
    selectedLote ? { lot: selectedLote } : {}
  );

  const transitPhones = useMemo(
    () => allLotePhones.filter((p) => p.estado === 'En Tránsito (a El Salvador)'),
    [allLotePhones]
  );

  // Build lookup maps: imei → Phone
  const transitMap = useMemo(() => {
    const m = new Map<string, Phone>();
    transitPhones.forEach((p) => {
      if (p.seized) return; // skip seized phones — excluded from receiving workflow
      m.set(p.imei, p);
    });
    return m;
  }, [transitPhones]);

  const allLoteMap = useMemo(() => {
    const m = new Map<string, Phone>();
    allLotePhones.forEach((p) => m.set(p.imei, p));
    return m;
  }, [allLotePhones]);

  const [scannedResults, setScannedResults] = useState<ScannedResult[]>([]);
  const [processedImeis] = useState(() => new Set<string>());
  const [isClosing, setIsClosing] = useState(false);

  const okCount = useMemo(
    () => scannedResults.filter((r) => r.status === 'ok').length,
    [scannedResults]
  );

  const expectedCount = transitPhones.length;

  const missingPhones = useMemo(
    () => transitPhones.filter((p) => !processedImeis.has(p.imei)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transitPhones, scannedResults]
  );

  const processScan = useCallback(
    (rawInput: string) => {
      const trimmed = rawInput.trim();

      // Extract IMEI from QR tracking URL: .../phone/353559560263301
      let imei: string;
      const urlMatch = trimmed.match(/\/phone\/(\d{14,15})(?:\?|$|#)/);
      if (urlMatch) {
        imei = urlMatch[1];
      } else {
        try {
          const url = new URL(trimmed);
          const pathMatch = url.pathname.match(/\/phone\/(\d{14,15})$/);
          if (pathMatch) {
            imei = pathMatch[1];
          } else {
            imei = trimmed.replace(/\D/g, '');
          }
        } catch {
          imei = trimmed.replace(/\D/g, '');
        }
      }

      if (!imei || imei.length < 8) return 'ignored' as const;

      // GS1 normalization: 16-digit barcodes starting with '1' → strip leading '1'
      if (imei.length === 16 && imei[0] === '1') {
        imei = imei.substring(1);
      }

      if (processedImeis.has(imei)) {
        setScannedResults((prev) => [{ imei, status: 'duplicate' }, ...prev]);
        return 'duplicate' as const;
      }

      processedImeis.add(imei);

      const expected = transitMap.get(imei);
      if (expected) {
        const info = [expected.marca, expected.modelo, expected.storage]
          .filter(Boolean)
          .join(' · ');
        setScannedResults((prev) => [
          { imei, status: 'ok', phoneId: expected.id, phoneInfo: info },
          ...prev,
        ]);
        return 'ok' as const;
      }

      // --- PARTIAL IMEI MATCHING (for short IMEIs entered by Eduardo) ---
      // If exact match failed, check if any transit phone has a short IMEI
      // that is a suffix of the scanned full IMEI
      const suffixMatches: Phone[] = [];
      transitMap.forEach((phone, storedImei) => {
        if (storedImei.length < imei.length && imei.endsWith(storedImei)) {
          suffixMatches.push(phone);
        }
      });

      if (suffixMatches.length === 1) {
        const matched = suffixMatches[0];
        // Guard against double-registration: if the stored short IMEI was
        // already scanned directly, this longer scan refers to the same phone.
        if (processedImeis.has(matched.imei)) {
          setScannedResults((prev) => [{ imei, status: 'duplicate' }, ...prev]);
          return 'duplicate' as const;
        }
        const info = [matched.marca, matched.modelo, matched.storage].filter(Boolean).join(' · ');
        // Track by the STORED imei so closeReceiving() can find it in transitMap
        processedImeis.add(matched.imei);
        setScannedResults((prev) => [
          {
            imei: matched.imei,
            status: 'ok',
            phoneId: matched.id,
            phoneInfo: `${info} (IMEI parcial corregido)`,
            fullScannedImei: imei,
          },
          ...prev,
        ]);
        return 'ok' as const;
      }

      if (suffixMatches.length > 1) {
        const names = suffixMatches.map((p) => `${p.marca} ${p.modelo} (${p.imei})`).join(', ');
        setScannedResults((prev) => [
          { imei, status: 'not_found', phoneInfo: `Ambiguo — múltiples coincidencias: ${names}` },
          ...prev,
        ]);
        return 'not_found' as const;
      }

      const other = allLoteMap.get(imei);
      if (other) {
        const info = `${other.marca} ${other.modelo}`;
        setScannedResults((prev) => [
          {
            imei,
            status: 'wrong_state',
            phoneId: other.id,
            phoneInfo: info,
            currentState: other.estado,
          },
          ...prev,
        ]);
        return 'wrong_state' as const;
      }

      setScannedResults((prev) => [{ imei, status: 'not_found' }, ...prev]);
      return 'not_found' as const;
    },
    [transitMap, allLoteMap, processedImeis]
  );

  const closeReceiving = useCallback(async (): Promise<{
    reportId: string;
    receivedPhones: Phone[];
    missingImeis: string[];
    lote: string;
  } | null> => {
    const okResults = scannedResults.filter((r) => r.status === 'ok');
    if (okResults.length === 0) return null;

    setIsClosing(true);
    try {
      const batch = writeBatch(db);
      const userEmail = auth.currentUser?.email || 'unknown';
      const now = new Date();

      okResults.forEach((r) => {
        if (!r.phoneId) return;
        const phoneRef = doc(db, 'phones', r.phoneId);
        const phone = transitMap.get(r.imei);
        const history = phone?.statusHistory || [];
        const updateData: Record<string, unknown> = {
          estado: 'En Stock (Disponible para Venta)',
          updatedAt: serverTimestamp(),
          statusHistory: [
            ...history,
            {
              newStatus: 'En Stock (Disponible para Venta)',
              date: now,
              user: userEmail,
              details: `Recibido – lote ${selectedLote}`,
            },
          ],
        };
        // Fix short IMEIs: if we matched a partial IMEI, update to the full scanned IMEI
        if (r.fullScannedImei && r.fullScannedImei !== r.imei) {
          updateData.imei = r.fullScannedImei;
        }
        batch.update(phoneRef, updateData);
      });

      await batch.commit();

      const missingImeis = transitPhones
        .filter((p) => !okResults.find((r) => r.imei === p.imei))
        .map((p) => p.imei);

      const unknownImeis = scannedResults
        .filter((r) => r.status === 'not_found')
        .map((r) => r.imei);

      const reportRef = await addDoc(collection(db, 'receivingReports'), {
        lote: selectedLote,
        receivedBy: userEmail,
        receivedAt: serverTimestamp(),
        expectedCount,
        receivedCount: okResults.length,
        missingImeis,
        unknownImeis,
        status: 'closed',
      });

      queryClient.invalidateQueries({ queryKey: ['phones'] });

      // Build the list of phones that were successfully received
      const receivedPhones: Phone[] = okResults
        .map((r) => transitMap.get(r.imei))
        .filter((p): p is Phone => p !== undefined);

      return {
        reportId: reportRef.id,
        receivedPhones,
        missingImeis,
        lote: selectedLote,
      };
    } finally {
      setIsClosing(false);
    }
  }, [scannedResults, transitMap, transitPhones, expectedCount, selectedLote, queryClient]);

  const reset = useCallback(() => {
    setScannedResults([]);
    processedImeis.clear();
  }, [processedImeis]);

  return {
    expectedCount,
    okCount,
    missingPhones,
    scannedResults,
    processScan,
    closeReceiving,
    reset,
    isLoading,
    isClosing,
  };
}

// Kept for compatibility with getDocs usage pattern — not used directly in hook
export { getDocs, query, where };
