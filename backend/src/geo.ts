const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/** Precision 5 cells are roughly 4.9 km x 4.9 km — the partition key for houses. */
export const CELL_PRECISION = 5;

export function encodeGeohash(lat: number, lng: number, precision = CELL_PRECISION): string {
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  let hash = '';
  let bit = 0, ch = 0, evenBit = true;
  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) { ch = (ch << 1) | 1; lngMin = mid; } else { ch <<= 1; lngMax = mid; }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) { ch = (ch << 1) | 1; latMin = mid; } else { ch <<= 1; latMax = mid; }
    }
    evenBit = !evenBit;
    if (++bit === 5) { hash += BASE32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

export function decodeGeohashBounds(hash: string) {
  let latMin = -90, latMax = 90, lngMin = -180, lngMax = 180;
  let evenBit = true;
  for (const c of hash) {
    const idx = BASE32.indexOf(c);
    if (idx < 0) throw new Error(`Invalid geohash character: ${c}`);
    for (let n = 4; n >= 0; n--) {
      const bitN = (idx >> n) & 1;
      if (evenBit) {
        const mid = (lngMin + lngMax) / 2;
        if (bitN) lngMin = mid; else lngMax = mid;
      } else {
        const mid = (latMin + latMax) / 2;
        if (bitN) latMin = mid; else latMax = mid;
      }
      evenBit = !evenBit;
    }
  }
  return { latMin, latMax, lngMin, lngMax };
}

/** The cell itself plus its 8 neighbours. */
export function cellAndNeighbours(hash: string): string[] {
  const { latMin, latMax, lngMin, lngMax } = decodeGeohashBounds(hash);
  const latStep = latMax - latMin;
  const lngStep = lngMax - lngMin;
  const lat = (latMin + latMax) / 2;
  const lng = (lngMin + lngMax) / 2;
  const cells = new Set<string>();
  for (const dLat of [-1, 0, 1]) {
    for (const dLng of [-1, 0, 1]) {
      const nLat = lat + dLat * latStep;
      if (nLat > 90 || nLat < -90) continue;
      let nLng = lng + dLng * lngStep;
      if (nLng > 180) nLng -= 360;
      if (nLng < -180) nLng += 360;
      cells.add(encodeGeohash(nLat, nLng, hash.length));
    }
  }
  return [...cells];
}

/** Great-circle distance in metres. */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function isValidCoordinate(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  );
}
