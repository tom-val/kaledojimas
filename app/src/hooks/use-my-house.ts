import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { ApiError, createHouse, deleteHouse, type House } from '@/utils/api';
import type { LatLng } from '@/utils/geo';

const STORAGE_KEY = 'knock-knock/my-house';

type Saved = { house: House; token: string };

const isExpired = (house: House) => house.expiresAt * 1000 <= Date.now();

/**
 * The house this device put on the map. The token returned on creation is the only
 * proof of ownership, so it lives in local storage and nowhere else.
 */
export function useMyHouse() {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        const parsed: Saved | null = raw ? JSON.parse(raw) : null;
        if (parsed && !isExpired(parsed.house)) setSaved(parsed);
        else if (parsed) AsyncStorage.removeItem(STORAGE_KEY);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  // Drop the house locally once the server-side TTL has passed.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => {
      setSaved(null);
      AsyncStorage.removeItem(STORAGE_KEY);
    }, Math.max(0, saved.house.expiresAt * 1000 - Date.now()));
    return () => clearTimeout(timer);
  }, [saved]);

  const mark = useCallback(async (input: { pin: LatLng; device: LatLng; note?: string }) => {
    const created = await createHouse(input);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(created));
    setSaved(created);
    return created.house;
  }, []);

  const end = useCallback(async () => {
    if (!saved) return;
    try {
      await deleteHouse(saved.house.id, saved.token);
    } catch (err) {
      // 404: already expired or gone — either way it's no longer on the map.
      if (!(err instanceof ApiError && err.status === 404)) throw err;
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
    setSaved(null);
  }, [saved]);

  return { myHouse: saved?.house ?? null, ready, mark, end };
}
