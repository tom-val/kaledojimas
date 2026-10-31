import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '@/constants/theme';
import { t } from '@/i18n';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: Colors.background, primary: Colors.pumpkin },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, title: t.appName }} />
    </ThemeProvider>
  );
}
