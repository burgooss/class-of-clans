import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { Notifier, ScheduledNotification } from './sync';

const CHANNEL_ID = 'builders';
// Marca para reconocer las notificaciones que programa esta app.
const SOURCE = 'builder-free';

/** Muestra las notificaciones también con la app abierta. Llamar una vez al arrancar. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

let channelReady = false;

// En Android 13+ el permiso solo se puede pedir después de crear un canal.
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Constructores libres',
    importance: Notifications.AndroidImportance.HIGH,
  });
  channelReady = true;
}

export const expoNotifier: Notifier = {
  async ensurePermission() {
    await ensureChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await Notifications.requestPermissionsAsync();
    return requested.granted;
  },

  async listScheduled(): Promise<ScheduledNotification[]> {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all
      .filter((n) => n.content.data?.source === SOURCE)
      .map((n) => ({ identifier: n.identifier, title: n.content.title, body: n.content.body }));
  },

  async schedule({ title, body, at }) {
    await ensureChannel();
    return Notifications.scheduleNotificationAsync({
      content: { title, body, data: { source: SOURCE } },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(at * 1000),
        channelId: CHANNEL_ID,
      },
    });
  },

  cancel(identifier) {
    return Notifications.cancelScheduledNotificationAsync(identifier);
  },
};
