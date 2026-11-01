import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HouseMap } from '@/components/house-map';
import type { Placement } from '@/components/house-map/types';
import { Colors, DefaultCenter, Spacing } from '@/constants/theme';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useMyHouse } from '@/hooks/use-my-house';
import { useNearbyHouses } from '@/hooks/use-nearby-houses';
import { type Strings, useI18n } from '@/i18n';
import { ApiError } from '@/utils/api';
import { clampToRadius, type LatLng, MAX_PIN_DISTANCE_M } from '@/utils/geo';

import { ActionPanel, type PanelMode } from './action-panel';

async function getLocation(ask: boolean): Promise<LatLng | 'denied' | 'failed'> {
  const { status } = ask
    ? await Location.requestForegroundPermissionsAsync()
    : await Location.getForegroundPermissionsAsync();
  if (status !== 'granted') return 'denied';
  try {
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return 'failed';
  }
}

function confirmEnd(t: Strings): Promise<boolean> {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${t.endConfirmTitle}\n${t.endConfirmBody}`));
  }
  return new Promise((resolve) =>
    Alert.alert(t.endConfirmTitle, t.endConfirmBody, [
      { text: t.cancel, style: 'cancel', onPress: () => resolve(false) },
      { text: t.endConfirm, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

// The API's own messages are English, so show ours instead.
function errorMessage(t: Strings, err: unknown) {
  if (err instanceof ApiError) return err.status === 422 ? t.tooFar : t.genericError;
  return t.offline;
}

export function Home() {
  const { t, language, locale, setLanguage } = useI18n();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const { myHouse, mark, end } = useMyHouse();
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [focus, setFocus] = useState<LatLng>(DefaultCenter);
  const [viewCenter, setViewCenter] = useState<LatLng>(DefaultCenter);
  const [placing, setPlacing] = useState<{ anchor: LatLng; pin: LatLng } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const nearby = useNearbyHouses(viewCenter);

  const locate = useCallback(async (ask: boolean) => {
    const result = await getLocation(ask);
    if (result === 'denied' || result === 'failed') {
      if (ask) setMessage(result === 'denied' ? t.locationDenied : t.locationFailed);
      return null;
    }
    setUserLocation(result);
    return result;
  }, [t]);

  // Centre on the user at launch; ask for permission straight away since the map is the whole app.
  useEffect(() => {
    getLocation(true).then((p) => {
      if (typeof p === 'object') {
        setUserLocation(p);
        setFocus(p);
      }
    });
  }, []);

  const startPlacing = async () => {
    setMessage(null);
    setBusy(true);
    const p = await locate(true);
    setBusy(false);
    if (!p) return;
    setPlacing({ anchor: p, pin: p });
    setFocus(p);
  };

  const confirmPlace = async (note: string) => {
    if (!placing) return;
    setBusy(true);
    setMessage(null);
    try {
      await mark({ pin: placing.pin, device: placing.anchor, note: note.trim() || undefined });
      setPlacing(null);
      nearby.refresh();
    } catch (err) {
      setMessage(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const endParticipation = async () => {
    if (!(await confirmEnd(t))) return;
    setBusy(true);
    setMessage(null);
    try {
      await end();
      nearby.refresh();
    } catch (err) {
      setMessage(errorMessage(t, err));
    } finally {
      setBusy(false);
    }
  };

  const placement = useMemo<Placement | null>(
    () =>
      placing && {
        ...placing,
        radius: MAX_PIN_DISTANCE_M,
        onPinChange: (pin) =>
          setPlacing((cur) => cur && { ...cur, pin: clampToRadius(cur.anchor, pin, MAX_PIN_DISTANCE_M) }),
      },
    [placing],
  );

  // Show my house straight away, even before the next nearby refresh picks it up.
  const houses = useMemo(
    () => (myHouse && !nearby.houses.some((h) => h.id === myHouse.id) ? [...nearby.houses, myHouse] : nearby.houses),
    [nearby.houses, myHouse],
  );

  const mode: PanelMode = placing ? 'placing' : myHouse ? 'live' : 'browse';
  const until = myHouse
    ? new Date(myHouse.expiresAt * 1000).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : undefined;

  return (
    <View style={styles.container}>
      <HouseMap
        focus={focus}
        houses={houses}
        myHouseId={myHouse?.id}
        userLocation={userLocation}
        placement={placement}
        onCenterChange={setViewCenter}
      />

      <View style={[styles.topBar, { top: insets.top + Spacing.two }]} pointerEvents="box-none">
        <View style={styles.chip}>
          <Text style={styles.chipTitle}>🎃 {t.appName}</Text>
          <Text style={styles.chipBody}>{nearby.failed ? t.offline : t.nearby(nearby.houses.length)}</Text>
        </View>
        <View style={styles.topButtons}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.switchLanguage}
            onPress={() => {
              setMessage(null);
              setLanguage(language === 'lt' ? 'en' : 'lt');
            }}
            style={({ pressed }) => [styles.roundButton, pressed && { opacity: 0.7 }]}>
            <Text style={styles.languageLabel}>{language === 'lt' ? 'EN' : 'LT'}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.recenter}
            onPress={() => locate(true).then((p) => p && setFocus(p))}
            style={({ pressed }) => [styles.roundButton, pressed && { opacity: 0.7 }]}>
            <Text style={styles.roundButtonIcon}>📍</Text>
          </Pressable>
        </View>
      </View>

      <View
        style={[styles.bottom, { paddingBottom: (keyboardHeight || insets.bottom) + Spacing.three }]}
        pointerEvents="box-none">
        <ActionPanel
          mode={mode}
          busy={busy}
          message={message}
          until={until}
          onMark={startPlacing}
          onConfirm={confirmPlace}
          onCancel={() => {
            setPlacing(null);
            setMessage(null);
          }}
          onEnd={endParticipation}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    position: 'absolute',
    zIndex: 10,
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  chip: {
    flexShrink: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 16,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(28, 19, 48, 0.92)',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  chipTitle: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  chipBody: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: Spacing.half,
    fontVariant: ['tabular-nums'],
  },
  topButtons: {
    marginLeft: 'auto',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(28, 19, 48, 0.92)',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  roundButtonIcon: {
    fontSize: 18,
  },
  languageLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  bottom: {
    position: 'absolute',
    zIndex: 10,
    left: Spacing.three,
    right: Spacing.three,
    bottom: 0,
  },
});
