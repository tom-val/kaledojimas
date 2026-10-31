import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * `app.json` is still the app's configuration; this file exists for the one value that cannot live
 * in static JSON — the Android Google Maps key, which comes from the environment.
 *
 * iOS needs nothing: react-native-maps uses Apple Maps there, which has no key and no account.
 * Android's map is Google's, and release builds need a key (Expo Go brings its own in development).
 * Leave `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` empty and the Android build still works — the map just
 * shows a blank background under the pins. The web build uses Leaflet + OpenStreetMap, no key.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY ?? '';

  return {
    ...config,
    // Both are set in `app.json`; the fallbacks only satisfy `ExpoConfig`.
    name: config.name ?? 'Knock Knock',
    slug: config.slug ?? 'knock-knock',
    plugins: [
      ...(config.plugins ?? []),
      ['react-native-maps', googleMapsApiKey ? { androidGoogleMapsApiKey: googleMapsApiKey } : {}],
    ],
  };
};
