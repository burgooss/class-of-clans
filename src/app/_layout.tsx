import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { migrateDb } from '@/db/migrations';
import { configureNotificationHandler, syncNow } from '@/notifications';
import { colors } from '@/theme';

configureNotificationHandler();

// Tema de navegación: fondo negro mate en pantallas, barra superior y barra de pestañas.
const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.bar,
    text: colors.text,
    border: colors.border,
  },
};

/** Al abrir la app deja las notificaciones al día (por si algo cambió mientras estaba cerrada). */
function NotificationsSync() {
  const db = useSQLiteContext();
  useEffect(() => {
    syncNow(db);
  }, [db]);
  return null;
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="clash-builders.db" onInit={migrateDb}>
      <NotificationsSync />
      <ThemeProvider value={theme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="account/[id]/index" options={{ title: 'Cuenta' }} />
          <Stack.Screen name="account/[id]/suggestions" options={{ title: 'Sugerencias' }} />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </SQLiteProvider>
  );
}
