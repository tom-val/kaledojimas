import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { Colors } from '@/constants/theme';
import { useI18n } from '@/i18n';

import type { HouseMapProps } from './types';

const ZOOMED_IN = { latitudeDelta: 0.012, longitudeDelta: 0.012 };

export function HouseMap({ focus, houses, myHouseId, placement, onCenterChange }: HouseMapProps) {
  const { t } = useI18n();
  const mapRef = useRef<MapView>(null);
  const isFirstFocus = useRef(true);

  useEffect(() => {
    if (isFirstFocus.current) {
      isFirstFocus.current = false;
      return;
    }
    mapRef.current?.animateToRegion({ latitude: focus.lat, longitude: focus.lng, ...ZOOMED_IN }, 500);
  }, [focus]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={{ latitude: focus.lat, longitude: focus.lng, ...ZOOMED_IN }}
      showsUserLocation
      showsMyLocationButton={false}
      userInterfaceStyle="dark"
      onRegionChangeComplete={(r) => onCenterChange({ lat: r.latitude, lng: r.longitude })}
      onPress={(e) => {
        // Tapping a marker also fires the map's onPress on iOS.
        if (e.nativeEvent.action === 'marker-press') return;
        const { latitude, longitude } = e.nativeEvent.coordinate;
        placement?.onPinChange({ lat: latitude, lng: longitude });
      }}>
      {houses
        .filter((h) => !(placement && h.id === myHouseId))
        .map((h) => {
          const mine = h.id === myHouseId;
          return (
            <Marker
              key={h.id}
              coordinate={{ latitude: h.lat, longitude: h.lng }}
              title={mine ? t.yourHouse : t.candyHere}
              description={h.note}
              zIndex={mine ? 2 : 1}>
              <View style={[styles.pin, mine && styles.pinMine]}>
                <Text style={styles.emoji}>🎃</Text>
              </View>
            </Marker>
          );
        })}

      {placement && (
        <>
          <Circle
            center={{ latitude: placement.anchor.lat, longitude: placement.anchor.lng }}
            radius={placement.radius}
            strokeColor={Colors.pumpkin}
            fillColor="rgba(255,122,26,0.12)"
            strokeWidth={2}
          />
          <Marker
            draggable
            coordinate={{ latitude: placement.pin.lat, longitude: placement.pin.lng }}
            onDragEnd={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              placement.onPinChange({ lat: latitude, lng: longitude });
            }}
            zIndex={3}>
            <View style={[styles.pin, styles.pinPlacing]}>
              <Text style={styles.emojiLarge}>🎃</Text>
            </View>
          </Marker>
        </>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.pumpkin,
  },
  pinMine: {
    backgroundColor: Colors.pumpkin,
    borderColor: Colors.text,
  },
  pinPlacing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderColor: Colors.text,
    borderWidth: 3,
  },
  emoji: { fontSize: 20 },
  emojiLarge: { fontSize: 26 },
});
