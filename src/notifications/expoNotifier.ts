import { Platform } from 'react-native';

import type { Notifier, ScheduledNotification } from './sync';

// POR QUÉ NO SE IMPORTA 'expo-notifications' DIRECTAMENTE
// En expo-notifications 58.1.5, el índice carga `topicSubscription`, que exige el módulo nativo
// `ExpoTopicSubscriptionModule`. El Expo Go de Android (58.0.5) no lo trae y la app se caía al
// arrancar ("Cannot find native module 'ExpoTopicSubscriptionModule'"). Para los avisos locales
// solo hacen falta 4 módulos nativos, que sí están en Expo Go, y ninguno de los archivos de
// abajo pasa por el índice ni por `topicSubscription`.
//
// Se cargan de forma perezosa y protegida: si algo falta, los avisos quedan desactivados
// (la sincronización avisa del fallo) pero la app sigue funcionando.
// Si una actualización de expo-notifications mueve estos archivos, falla la prueba
// `expoNotifierPaths.test.ts`.
const BASE = 'expo-notifications/build';

type Api = {
  setNotificationHandler: typeof import('expo-notifications/build/NotificationsHandler').setNotificationHandler;
  getPermissionsAsync: typeof import('expo-notifications/build/NotificationPermissions').getPermissionsAsync;
  requestPermissionsAsync: typeof import('expo-notifications/build/NotificationPermissions').requestPermissionsAsync;
  setNotificationChannelAsync: typeof import('expo-notifications/build/setNotificationChannelAsync').setNotificationChannelAsync;
  scheduleNotificationAsync: typeof import('expo-notifications/build/scheduleNotificationAsync').scheduleNotificationAsync;
  cancelScheduledNotificationAsync: typeof import('expo-notifications/build/cancelScheduledNotificationAsync').cancelScheduledNotificationAsync;
  getAllScheduledNotificationsAsync: typeof import('expo-notifications/build/getAllScheduledNotificationsAsync').getAllScheduledNotificationsAsync;
  SchedulableTriggerInputTypes: typeof import('expo-notifications/build/Notifications.types').SchedulableTriggerInputTypes;
  AndroidImportance: typeof import('expo-notifications/build/NotificationChannelManager.types').AndroidImportance;
};

let cached: Api | null | undefined;

function loadApi(): Api | null {
  if (cached !== undefined) return cached;
  try {
    // Las rutas deben ser literales para que Metro las incluya en el bundle.
    /* eslint-disable @typescript-eslint/no-require-imports */
    cached = {
      setNotificationHandler: require('expo-notifications/build/NotificationsHandler').setNotificationHandler,
      getPermissionsAsync: require('expo-notifications/build/NotificationPermissions').getPermissionsAsync,
      requestPermissionsAsync: require('expo-notifications/build/NotificationPermissions').requestPermissionsAsync,
      setNotificationChannelAsync: require('expo-notifications/build/setNotificationChannelAsync').setNotificationChannelAsync,
      scheduleNotificationAsync: require('expo-notifications/build/scheduleNotificationAsync').scheduleNotificationAsync,
      cancelScheduledNotificationAsync: require('expo-notifications/build/cancelScheduledNotificationAsync').cancelScheduledNotificationAsync,
      getAllScheduledNotificationsAsync: require('expo-notifications/build/getAllScheduledNotificationsAsync').getAllScheduledNotificationsAsync,
      SchedulableTriggerInputTypes: require('expo-notifications/build/Notifications.types').SchedulableTriggerInputTypes,
      AndroidImportance: require('expo-notifications/build/NotificationChannelManager.types').AndroidImportance,
    };
    /* eslint-enable @typescript-eslint/no-require-imports */
  } catch (error) {
    console.warn(`No se pudo cargar ${BASE}: los avisos quedan desactivados.`, error);
    cached = null;
  }
  return cached;
}

function requireApi(): Api {
  const api = loadApi();
  if (!api) throw new Error('Las notificaciones no están disponibles en esta versión de la app.');
  return api;
}

const CHANNEL_ID = 'builders';
// Marca para reconocer las notificaciones que programa esta app.
const SOURCE = 'builder-free';

/** Muestra las notificaciones también con la app abierta. Llamar una vez al arrancar; nunca lanza. */
export function configureNotificationHandler(): void {
  const api = loadApi();
  if (!api) return;
  try {
    api.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (error) {
    console.warn('No se pudo configurar el manejador de notificaciones.', error);
  }
}

// 'unknown' = aún no se intentó; 'ready' = canal creado; 'failed' = falló (se usa el canal por defecto).
let channelState: 'unknown' | 'ready' | 'failed' = 'unknown';

/**
 * Crea el canal de Android (en Android 13+ el permiso solo se puede pedir después de crear uno).
 * Devuelve true si el canal existe. Si falla, se registra una sola vez y los avisos se programan
 * en el canal por defecto de Android (sin `channelId`) en lugar de perderse.
 * La configuración es la del ejemplo de la documentación de Expo.
 */
async function ensureChannel(api: Api): Promise<boolean> {
  if (Platform.OS !== 'android') return false;
  if (channelState !== 'unknown') return channelState === 'ready';
  try {
    await api.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Constructores libres',
      importance: api.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
    channelState = 'ready';
  } catch (error) {
    console.warn('No se pudo crear el canal de notificaciones; se usará el canal por defecto.', error);
    channelState = 'failed';
  }
  return channelState === 'ready';
}

export const expoNotifier: Notifier = {
  async ensurePermission() {
    const api = requireApi();
    await ensureChannel(api);
    const current = await api.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await api.requestPermissionsAsync();
    return requested.granted;
  },

  async listScheduled(): Promise<ScheduledNotification[]> {
    // Sin la librería no hay nada programado que sincronizar.
    const api = loadApi();
    if (!api) return [];
    const all = await api.getAllScheduledNotificationsAsync();
    return all
      .filter((n) => n.content.data?.source === SOURCE)
      .map((n) => ({ identifier: n.identifier, title: n.content.title, body: n.content.body }));
  },

  async schedule({ title, body, at }) {
    const api = requireApi();
    const hasChannel = await ensureChannel(api);
    return api.scheduleNotificationAsync({
      content: { title, body, data: { source: SOURCE } },
      trigger: {
        type: api.SchedulableTriggerInputTypes.DATE,
        date: new Date(at * 1000),
        ...(hasChannel ? { channelId: CHANNEL_ID } : {}),
      },
    });
  },

  async cancel(identifier) {
    await requireApi().cancelScheduledNotificationAsync(identifier);
  },
};
