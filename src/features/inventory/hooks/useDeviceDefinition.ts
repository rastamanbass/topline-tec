import { useState, useEffect } from 'react';
import { getDeviceDefinition, type DeviceDefinition } from '../services/deviceService';
import { fetchDeviceFromProxy } from '../services/proxyService';

/** Normalize an IMEI for TAC lookup: strips GS1 leading-"1" artifact on 16-digit strings. */
function normalizeIMEIForLookup(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 16 && digits[0] === '1') return digits.slice(1);
  return digits;
}

export function useDeviceDefinition(imei: string) {
  const [definition, setDefinition] = useState<DeviceDefinition | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const fetchDefinition = async () => {
      if (!imei || imei.length < 8) {
        setDefinition(null);
        return;
      }

      const normalized = normalizeIMEIForLookup(imei);
      const tac = normalized.substring(0, 8);
      setIsLoading(true);

      // 1. Check Local Cache (Firestore) first
      let def = await getDeviceDefinition(tac); // Needs updated import if not there? Imported above.

      // 2. If not found in Cache, try "Galactic Proxy" 🚀
      if (!def && normalized.length >= 8) {
        try {
          const proxyResult = await fetchDeviceFromProxy(normalized);
          if (proxyResult) {
            def = {
              brand: proxyResult.brand,
              model: proxyResult.model,
              updatedAt: Date.now(),
            };
          }
        } catch (e) {
          console.error('Proxy failed silently', e);
        }
      }

      if (isMounted) {
        setDefinition(def);
        setIsLoading(false);
      }
    };

    // Debounce to save API credits
    const timeoutId = setTimeout(fetchDefinition, 1000);
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [imei]);

  return { definition, isLoading };
}
