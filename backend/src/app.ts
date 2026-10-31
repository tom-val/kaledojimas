import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { CELL_PRECISION, cellAndNeighbours, decodeGeohashBounds, distanceMeters, encodeGeohash, isValidCoordinate } from './geo.ts';
import type { HouseItem, HouseStore } from './store.ts';

/** How far the house pin may be from where the phone actually is. */
export const MAX_PIN_DISTANCE_M = 150;
export const DEFAULT_RADIUS_M = 2000;
export const MAX_NOTE_LENGTH = 80;
/** Houses disappear on their own if the owner forgets to end participation. */
export const HOUSE_TTL_SECONDS = 6 * 60 * 60;

const ID_PATTERN = new RegExp(`^[0-9bcdefghjkmnpqrstuvwxyz]{${CELL_PRECISION}}_[0-9a-f-]{36}$`);

export interface ApiRequest {
  method: string;
  path: string;
  query: Record<string, string | undefined>;
  headers: Record<string, string | undefined>;
  body?: string;
}

export interface ApiResponse {
  status: number;
  body?: unknown;
}

export interface PublicHouse {
  id: string;
  lat: number;
  lng: number;
  note?: string;
  createdAt: number;
  expiresAt: number;
}

const error = (status: number, message: string): ApiResponse => ({ status, body: { error: message } });

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const toPublic = ({ id, lat, lng, note, createdAt, expiresAt }: HouseItem): PublicHouse =>
  ({ id, lat, lng, note, createdAt, expiresAt });

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function cleanNote(note: unknown): string | undefined {
  if (typeof note !== 'string') return undefined;
  // Strip control characters and collapse whitespace.
  const cleaned = note.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned.slice(0, MAX_NOTE_LENGTH) : undefined;
}

/**
 * The 3x3 block of cells around a point always covers at least one cell's width in
 * every direction; east-west that shrinks with latitude, so clamp the radius to it.
 */
function maxCoveredRadius(lat: number, lng: number): number {
  const { latMin, latMax, lngMin, lngMax } = decodeGeohashBounds(encodeGeohash(lat, lng));
  const latStepM = distanceMeters(latMin, lng, latMax, lng);
  const lngStepM = distanceMeters(lat, lngMin, lat, lngMax);
  return Math.floor(Math.min(latStepM, lngStepM));
}

async function listHouses(req: ApiRequest, store: HouseStore, nowSeconds: number): Promise<ApiResponse> {
  const lat = parseNumber(req.query.lat);
  const lng = parseNumber(req.query.lng);
  if (!isValidCoordinate(lat, lng)) return error(400, 'lat and lng query parameters are required');

  const radius = Math.min(parseNumber(req.query.radius) ?? DEFAULT_RADIUS_M, maxCoveredRadius(lat, lng!));
  const cells = cellAndNeighbours(encodeGeohash(lat, lng!));
  const perCell = await Promise.all(cells.map((cell) => store.listCell(cell, nowSeconds)));

  const houses = perCell
    .flat()
    .map((h) => ({ house: h, distance: distanceMeters(lat, lng!, h.lat, h.lng) }))
    .filter(({ distance }) => distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .map(({ house }) => toPublic(house));

  return { status: 200, body: { radius, houses } };
}

async function createHouse(req: ApiRequest, store: HouseStore, nowSeconds: number): Promise<ApiResponse> {
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(req.body ?? '{}');
  } catch {
    return error(400, 'Body must be JSON');
  }
  const { lat, lng, deviceLat, deviceLng } = input;
  if (!isValidCoordinate(lat, lng)) return error(400, 'lat and lng are required');
  if (!isValidCoordinate(deviceLat, deviceLng)) return error(400, 'deviceLat and deviceLng are required');

  const pinDistance = distanceMeters(lat, lng as number, deviceLat, deviceLng as number);
  if (pinDistance > MAX_PIN_DISTANCE_M) {
    return error(422, `Your house must be within ${MAX_PIN_DISTANCE_M} m of where you are now`);
  }

  const cell = encodeGeohash(lat, lng as number);
  const token = randomBytes(24).toString('base64url');
  const item: HouseItem = {
    cell,
    id: `${cell}_${randomUUID()}`,
    lat,
    lng: lng as number,
    note: cleanNote(input.note),
    tokenHash: hashToken(token),
    createdAt: nowSeconds,
    expiresAt: nowSeconds + HOUSE_TTL_SECONDS,
  };
  await store.put(item);
  return { status: 201, body: { house: toPublic(item), token } };
}

async function endHouse(id: string, req: ApiRequest, store: HouseStore): Promise<ApiResponse> {
  if (!ID_PATTERN.test(id)) return error(404, 'House not found');
  const token = req.headers['x-house-token'];
  if (!token) return error(401, 'x-house-token header is required');

  const deleted = await store.deleteOwned(id.slice(0, CELL_PRECISION), id, hashToken(token));
  // Same response for "missing" and "not yours" so ids can't be probed.
  return deleted ? { status: 204 } : error(404, 'House not found');
}

export async function handleRequest(req: ApiRequest, store: HouseStore, now = Date.now()): Promise<ApiResponse> {
  const nowSeconds = Math.floor(now / 1000);
  const path = req.path.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();

  if (path === '/health' && method === 'GET') return { status: 200, body: { ok: true } };

  if (path === '/v1/houses') {
    if (method === 'GET') return listHouses(req, store, nowSeconds);
    if (method === 'POST') return createHouse(req, store, nowSeconds);
    return error(405, 'Method not allowed');
  }

  const match = /^\/v1\/houses\/([^/]+)$/.exec(path);
  if (match) {
    if (method === 'DELETE') return endHouse(decodeURIComponent(match[1]), req, store);
    return error(405, 'Method not allowed');
  }

  return error(404, 'Not found');
}
