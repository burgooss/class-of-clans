import type { SQLiteDatabase } from 'expo-sqlite';

import { occupiesBuilder } from '@/domain/builders';
import { levelSuffix, upgradeName } from '@/domain/names';

/** Notificación programada, tal como la devuelve el sistema (solo las de esta app). */
export type ScheduledNotification = {
  identifier: string;
  title: string | null;
  body: string | null;
};

/** Acceso al sistema de notificaciones. Lo implementa expo-notifications; en pruebas, un doble. */
export interface Notifier {
  /** Pide permiso si hace falta. Devuelve true si se pueden mostrar notificaciones. */
  ensurePermission(): Promise<boolean>;
  listScheduled(): Promise<ScheduledNotification[]>;
  /** Programa una notificación para `at` (epoch, segundos) y devuelve su identificador. */
  schedule(notification: { title: string; body: string; at: number }): Promise<string>;
  cancel(identifier: string): Promise<void>;
}

type UpgradeRow = {
  id: number;
  game_id: number;
  name: string | null;
  target_level: number | null;
  ends_at: number;
  notification_id: string | null;
  alias: string;
  notifications_on: number;
};

export type SyncResult = {
  scheduled: number;
  cancelled: number;
  /** Mejoras que debían avisar pero no se pudieron programar. */
  failed: number;
  /** true si había avisos por programar y el usuario no dio permiso. */
  permissionDenied: boolean;
};

function messageFor(row: UpgradeRow): { title: string; body: string } {
  return {
    title: `${row.alias}: constructor libre`,
    body: `Terminó: ${upgradeName(row.game_id, row.name)}${levelSuffix(row.target_level)}`,
  };
}

/**
 * Deja las notificaciones programadas iguales a las que corresponden según la base de
 * datos (F4): una por cada mejora de constructor en curso de las cuentas con avisos
 * activados. Es idempotente, así que se puede llamar después de cualquier cambio
 * (importar, renombrar, borrar, activar/desactivar) y al abrir la app.
 *
 * - Cancela las que ya no corresponden (cuenta borrada, avisos apagados, export
 *   reemplazado) o cuyo texto cambió (alias nuevo).
 * - Programa las que faltan y guarda su ID en `active_upgrades.notification_id`.
 * - Una mejora que ya terminó no avisa.
 *
 * @param now Hora actual (epoch, segundos).
 */
export async function syncNotifications(db: SQLiteDatabase, notifier: Notifier, now: number): Promise<SyncResult> {
  const rows = await db.getAllAsync<UpgradeRow>(
    `SELECT u.id, u.game_id, u.name, u.target_level, u.ends_at, u.notification_id,
            a.alias, a.notifications_on
       FROM active_upgrades u JOIN accounts a ON a.id = u.account_id
      WHERE u.slot_type = 'builder'
      ORDER BY u.ends_at`,
  );
  const scheduled = await notifier.listScheduled();
  const scheduledById = new Map(scheduled.map((s) => [s.identifier, s]));

  const wanted = rows.filter(
    (r) => r.notifications_on === 1 && r.ends_at > now && occupiesBuilder({ gameId: r.game_id, endsAt: r.ends_at }),
  );

  const keptIds = new Set<string>();
  const missing: UpgradeRow[] = [];
  for (const row of wanted) {
    const existing = row.notification_id ? scheduledById.get(row.notification_id) : undefined;
    const { title, body } = messageFor(row);
    if (existing && existing.title === title && existing.body === body) {
      keptIds.add(existing.identifier);
    } else {
      missing.push(row);
    }
  }

  const toCancel = scheduled.filter((s) => !keptIds.has(s.identifier));
  for (const item of toCancel) await notifier.cancel(item.identifier);

  // Las filas que apuntaban a una notificación que ya no existe quedan sin ID.
  for (const row of rows) {
    if (row.notification_id && !keptIds.has(row.notification_id)) {
      await db.runAsync('UPDATE active_upgrades SET notification_id = NULL WHERE id = ?', row.id);
    }
  }

  const result: SyncResult = { scheduled: 0, cancelled: toCancel.length, failed: 0, permissionDenied: false };
  if (missing.length === 0) return result;

  if (!(await notifier.ensurePermission())) {
    result.permissionDenied = true;
    return result;
  }

  for (const row of missing) {
    try {
      const identifier = await notifier.schedule({ ...messageFor(row), at: row.ends_at });
      await db.runAsync('UPDATE active_upgrades SET notification_id = ? WHERE id = ?', identifier, row.id);
      result.scheduled++;
    } catch {
      // Se reintenta en la próxima sincronización.
      result.failed++;
    }
  }
  return result;
}
