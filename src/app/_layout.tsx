import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';

import { migrateDb } from '@/db/migrations';

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName="clash-builders.db" onInit={migrateDb}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="account/[id]/index" options={{ title: 'Cuenta' }} />
        <Stack.Screen name="account/[id]/suggestions" options={{ title: 'Sugerencias' }} />
      </Stack>
      <StatusBar style="auto" />
    </SQLiteProvider>
  );
}
