import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '@/constants/theme';
import { useI18n } from '@/i18n';

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: Colors.background, primary: Colors.pumpkin },
};

export default function RootLayout() {
  const { t } = useI18n();

  return (
    <ThemeProvider value={theme}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, title: t.appName }} />
    </ThemeProvider>
  );
}
