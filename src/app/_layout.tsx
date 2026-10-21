import { Stack } from 'expo-router';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { migrateDb } from '@/db/migrations';
import { configureNotificationHandler, syncNow } from '@/notifications';

configureNotificationHandler();

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
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="account/[id]/index" options={{ title: 'Cuenta' }} />
        <Stack.Screen name="account/[id]/suggestions" options={{ title: 'Sugerencias' }} />
      </Stack>
      <StatusBar style="auto" />
    </SQLiteProvider>
  );
}
