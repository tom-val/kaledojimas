import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HOUSE_TTL_SECONDS, handleRequest } from './app.ts';
import { cellAndNeighbours, encodeGeohash } from './geo.ts';
import { createMemoryStore } from './store.ts';

// Vilnius Cathedral Square
const HOME = { lat: 54.6858, lng: 25.2877 };

const get = (lat: number, lng: number) => ({ method: 'GET', path: '/v1/houses', query: { lat: String(lat), lng: String(lng) }, headers: {} });
const post = (body: unknown) => ({ method: 'POST', path: '/v1/houses', query: {}, headers: {}, body: JSON.stringify(body) });
const del = (id: string, token?: string) => ({ method: 'DELETE', path: `/v1/houses/${id}`, query: {}, headers: { 'x-house-token': token } });

test('geohash matches known value', () => {
  assert.equal(encodeGeohash(57.64911, 10.40744, 11), 'u4pruydqqvj');
});

test('neighbours are 9 distinct cells', () => {
  assert.equal(cellAndNeighbours(encodeGeohash(HOME.lat, HOME.lng)).length, 9);
});

test('mark, list and end a house', async () => {
  const store = createMemoryStore();
  const created = await handleRequest(post({ ...HOME, deviceLat: HOME.lat + 0.0003, deviceLng: HOME.lng, note: '  Full-size bars! \u0007 ' }), store);
  assert.equal(created.status, 201);
  const { house, token } = created.body as { house: { id: string; note: string }; token: string };
  assert.equal(house.note, 'Full-size bars!');

  // ~1.2 km away, likely in a neighbouring cell
  const listed = await handleRequest(get(HOME.lat + 0.011, HOME.lng), store);
  assert.deepEqual((listed.body as { houses: { id: string }[] }).houses.map((h) => h.id), [house.id]);

  assert.equal((await handleRequest(del(house.id), store)).status, 401);
  assert.equal((await handleRequest(del(house.id, 'wrong-token'), store)).status, 404);
  assert.equal((await handleRequest(del(house.id, token), store)).status, 204);

  const after = await handleRequest(get(HOME.lat, HOME.lng), store);
  assert.equal((after.body as { houses: unknown[] }).houses.length, 0);
});

test('rejects a pin too far from the device', async () => {
  const res = await handleRequest(post({ ...HOME, deviceLat: HOME.lat + 0.01, deviceLng: HOME.lng }), createMemoryStore());
  assert.equal(res.status, 422);
});

test('houses outside the radius are not listed', async () => {
  const store = createMemoryStore();
  await handleRequest(post({ ...HOME, deviceLat: HOME.lat, deviceLng: HOME.lng }), store);
  const res = await handleRequest(get(HOME.lat + 0.05, HOME.lng), store); // ~5.5 km north
  assert.equal((res.body as { houses: unknown[] }).houses.length, 0);
});

test('expired houses are hidden', async () => {
  const store = createMemoryStore();
  const now = Date.now();
  await handleRequest(post({ ...HOME, deviceLat: HOME.lat, deviceLng: HOME.lng }), store, now);
  const later = now + (HOUSE_TTL_SECONDS + 1) * 1000;
  const res = await handleRequest(get(HOME.lat, HOME.lng), store, later);
  assert.equal((res.body as { houses: unknown[] }).houses.length, 0);
});
