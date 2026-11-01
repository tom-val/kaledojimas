import 'leaflet/dist/leaflet.css';

import type * as Leaflet from 'leaflet';
import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { useI18n } from '@/i18n';

import type { HouseMapProps } from './types';

const ZOOM = 15;

/** Built from DOM nodes rather than HTML strings, so notes can't inject markup. */
function popupContent(title: string, note?: string) {
  const root = document.createElement('div');
  const strong = document.createElement('strong');
  strong.textContent = title;
  root.append(strong);
  if (note) {
    const p = document.createElement('div');
    p.textContent = note;
    root.append(p);
  }
  return root;
}

export function HouseMap({ focus, houses, myHouseId, userLocation, placement, onCenterChange }: HouseMapProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const [L, setL] = useState<typeof Leaflet | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const housesLayer = useRef<Leaflet.LayerGroup | null>(null);
  const overlayLayer = useRef<Leaflet.LayerGroup | null>(null);
  const isFirstFocus = useRef(true);

  // Leaflet handlers are bound once; effect events always see the latest props.
  const emitCenter = useEffectEvent((lat: number, lng: number) => onCenterChange({ lat, lng }));
  const emitPin = useEffectEvent((lat: number, lng: number) => placement?.onPinChange({ lat, lng }));

  useEffect(() => {
    let cancelled = false;
    // Leaflet touches `window` on import, so load it only in the browser.
    import('leaflet').then((mod) => {
      if (cancelled || !containerRef.current) return;
      const leaflet = (mod as unknown as { default?: typeof Leaflet }).default ?? mod;
      const map = leaflet.map(containerRef.current, { zoomControl: false }).setView([focus.lat, focus.lng], ZOOM);
      leaflet
        .tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        })
        .addTo(map);
      leaflet.control.zoom({ position: 'topright' }).addTo(map);
      map.on('moveend', () => {
        const c = map.getCenter();
        emitCenter(c.lat, c.lng);
      });
      map.on('click', (e) => emitPin(e.latlng.lat, e.latlng.lng));
      housesLayer.current = leaflet.layerGroup().addTo(map);
      overlayLayer.current = leaflet.layerGroup().addTo(map);
      mapRef.current = map;
      setL(leaflet);
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // The map is created once; later focus changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    if (isFirstFocus.current) {
      isFirstFocus.current = false;
      mapRef.current.setView([focus.lat, focus.lng], ZOOM);
      return;
    }
    mapRef.current.flyTo([focus.lat, focus.lng], Math.max(mapRef.current.getZoom(), ZOOM), { duration: 0.6 });
  }, [focus, L]);

  useEffect(() => {
    const layer = housesLayer.current;
    if (!L || !layer) return;
    layer.clearLayers();
    for (const h of houses) {
      if (placement && h.id === myHouseId) continue;
      const mine = h.id === myHouseId;
      L.marker([h.lat, h.lng], {
        icon: L.divIcon({ className: mine ? 'kk-pin kk-pin-mine' : 'kk-pin', html: '🎃', iconSize: [36, 36] }),
        zIndexOffset: mine ? 1000 : 0,
        title: mine ? t.yourHouse : t.candyHere,
      })
        .bindPopup(popupContent(mine ? t.yourHouse : t.candyHere, h.note))
        .addTo(layer);
    }
  }, [L, houses, myHouseId, placement, t]);

  useEffect(() => {
    const layer = overlayLayer.current;
    if (!L || !layer) return;
    layer.clearLayers();
    if (userLocation) {
      L.marker([userLocation.lat, userLocation.lng], {
        icon: L.divIcon({ className: 'kk-me', iconSize: [18, 18] }),
        interactive: false,
      }).addTo(layer);
    }
    if (placement) {
      L.circle([placement.anchor.lat, placement.anchor.lng], {
        radius: placement.radius,
        color: '#FF7A1A',
        weight: 2,
        fillOpacity: 0.12,
        interactive: false,
      }).addTo(layer);
      const pin = L.marker([placement.pin.lat, placement.pin.lng], {
        icon: L.divIcon({ className: 'kk-pin kk-pin-placing', html: '🎃', iconSize: [48, 48] }),
        draggable: true,
        zIndexOffset: 2000,
      }).addTo(layer);
      pin.on('dragend', () => {
        const p = pin.getLatLng();
        emitPin(p.lat, p.lng);
      });
    }
  }, [L, userLocation, placement]);

  // `isolation` keeps Leaflet's z-indexed panes below the overlays rendered after the map.
  return <div ref={containerRef} className="kk-map" style={{ position: 'absolute', inset: 0, zIndex: 0, isolation: 'isolate' }} />;
}
