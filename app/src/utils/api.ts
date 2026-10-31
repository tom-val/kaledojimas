import Constants from 'expo-constants';

import type { LatLng } from '@/utils/geo';

export type House = {
  id: string;
  lat: number;
  lng: number;
  note?: string;
  createdAt: number;
  /** Epoch seconds. */
  expiresAt: number;
};

/**
 * EXPO_PUBLIC_API_URL in production. In development, fall back to the local API
 * server on the same machine as the Expo dev server, so phones on the LAN reach it too.
 */
const API_URL = (
  process.env.EXPO_PUBLIC_API_URL ?? `http://${Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost'}:3001`
).replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, init);
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? res.statusText);
  return body as T;
}

export function fetchNearbyHouses(center: LatLng, signal?: AbortSignal) {
  return request<{ radius: number; houses: House[] }>(`/v1/houses?lat=${center.lat}&lng=${center.lng}`, { signal });
}

export function createHouse(input: { pin: LatLng; device: LatLng; note?: string }) {
  return request<{ house: House; token: string }>('/v1/houses', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      lat: input.pin.lat,
      lng: input.pin.lng,
      deviceLat: input.device.lat,
      deviceLng: input.device.lng,
      note: input.note,
    }),
  });
}

export function deleteHouse(id: string, token: string) {
  return request<void>(`/v1/houses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'x-house-token': token },
  });
}
