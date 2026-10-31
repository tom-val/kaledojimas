import { useCallback, useEffect, useState } from 'react';

import { fetchNearbyHouses, type House } from '@/utils/api';
import type { LatLng } from '@/utils/geo';

const REFRESH_MS = 30_000;
const DEBOUNCE_MS = 400;

/** Houses around `center`, refetched when the map settles and every 30 s. */
export function useNearbyHouses(center: LatLng) {
  const [houses, setHouses] = useState<House[]>([]);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  // Round to ~100 m so tiny map nudges don't refetch.
  const key = `${center.lat.toFixed(3)},${center.lng.toFixed(3)}`;

  useEffect(() => {
    const controller = new AbortController();
    const [lat, lng] = key.split(',').map(Number);
    const timer = setTimeout(() => {
      fetchNearbyHouses({ lat, lng }, controller.signal)
        .then((res) => {
          setHouses(res.houses);
          setFailed(false);
        })
        .catch((err) => {
          if (!controller.signal.aborted) setFailed(true);
          if (__DEV__ && !controller.signal.aborted) console.warn('Failed to load houses', err);
        });
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, tick]);

  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), REFRESH_MS);
    return () => clearInterval(interval);
  }, []);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  return { houses, failed, refresh };
}
