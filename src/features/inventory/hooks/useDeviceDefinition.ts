import { useState, useEffect } from 'react';
import { getDeviceDefinition, type DeviceDefinition } from '../services/deviceService';
import { fetchDeviceFromProxy } from '../services/proxyService';

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

      const tac = imei.substring(0, 8);
      setIsLoading(true);

      // 1. Check Local Cache (Firestore) first
      let def = await getDeviceDefinition(tac); // Needs updated import if not there? Imported above.

      // 2. If not found in Cache, try "Galactic Proxy" 🚀
      if (!def && imei.length >= 8) {
        // Only fetch proxy if we have at least TAC
        try {
          // We can fire this. Creating a mock obj to return compatible shape
          const proxyResult = await fetchDeviceFromProxy(imei);
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
