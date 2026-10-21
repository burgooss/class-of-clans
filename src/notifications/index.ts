import type { SQLiteDatabase } from 'expo-sqlite';

import { expoNotifier } from './expoNotifier';
import { type SyncResult, syncNotifications } from './sync';

export { configureNotificationHandler } from './expoNotifier';
export type { SyncResult } from './sync';

/**
 * Sincroniza las notificaciones del sistema con la base de datos. Nunca lanza: un fallo
 * en las notificaciones no debe deshacer ni ocultar el cambio que lo provocó. Devuelve
 * null si falló (se reintenta en la próxima sincronización).
 */
export async function syncNow(db: SQLiteDatabase): Promise<SyncResult | null> {
  try {
    return await syncNotifications(db, expoNotifier, Math.floor(Date.now() / 1000));
  } catch (error) {
    console.warn('No se pudieron sincronizar las notificaciones', error);
    return null;
  }
}

export const PERMISSION_HELP =
  'Las notificaciones están bloqueadas para la app. Actívalas en los ajustes del sistema para recibir avisos.';
