export type LatLng = { lat: number; lng: number };

/** Must match MAX_PIN_DISTANCE_M in the API. */
export const MAX_PIN_DISTANCE_M = 150;

export function distanceMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Pulls `point` back onto the circle around `center` if it is outside it. */
export function clampToRadius(center: LatLng, point: LatLng, radius: number): LatLng {
  const d = distanceMeters(center, point);
  if (d <= radius) return point;
  // Over 150 m a straight-line interpolation in degrees is plenty accurate.
  const k = (radius * 0.98) / d;
  return { lat: center.lat + (point.lat - center.lat) * k, lng: center.lng + (point.lng - center.lng) * k };
}
