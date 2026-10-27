import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';

// Alarma ante actualizaciones: expoNotifier.ts importa archivos internos de expo-notifications
// para evitar `topicSubscription` (que no existe en Expo Go). Si una versión nueva los mueve o
// les cambia los nombres, esta prueba falla antes de que lo descubra el teléfono.
const ROOT = dirname(require.resolve('expo-notifications/package.json'));

const EXPECTED: [file: string, exportName: string][] = [
  ['NotificationsHandler', 'setNotificationHandler'],
  ['NotificationPermissions', 'getPermissionsAsync'],
  ['NotificationPermissions', 'requestPermissionsAsync'],
  ['setNotificationChannelAsync', 'setNotificationChannelAsync'],
  ['scheduleNotificationAsync', 'scheduleNotificationAsync'],
  ['cancelScheduledNotificationAsync', 'cancelScheduledNotificationAsync'],
  ['getAllScheduledNotificationsAsync', 'getAllScheduledNotificationsAsync'],
  ['Notifications.types', 'SchedulableTriggerInputTypes'],
  ['NotificationChannelManager.types', 'AndroidImportance'],
];

describe('rutas internas de expo-notifications que usa expoNotifier', () => {
  it.each(EXPECTED)('%s exporta %s', (file, exportName) => {
    const path = join(ROOT, 'build', `${file}.js`);
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8')).toMatch(new RegExp(`export (async )?(function|var|const) ${exportName}\\b`));
    expect(existsSync(join(ROOT, 'build', `${file}.d.ts`))).toBe(true);
  });

  it('ninguno de esos archivos importa el índice ni topicSubscription', () => {
    for (const [file] of EXPECTED) {
      const src = readFileSync(join(ROOT, 'build', `${file}.js`), 'utf8');
      expect(src).not.toMatch(/topicSubscription|from '\.\/index'|from '\.'/i);
    }
  });
});

describe('expoNotifier.ts', () => {
  it('no importa el índice de expo-notifications', () => {
    const src = readFileSync(join(__dirname, '..', 'expoNotifier.ts'), 'utf8');
    expect(src).not.toMatch(/from 'expo-notifications'|require\('expo-notifications'\)/);
  });
});
