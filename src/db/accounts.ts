import type { SQLiteDatabase } from 'expo-sqlite';

import { MAX_AMOUNT, type Resources } from '@/domain/resources';

export type AccountErrorCode = 'alias_required' | 'not_found' | 'invalid_amount';

export class AccountError extends Error {
  readonly code: AccountErrorCode;

  constructor(code: AccountErrorCode, message: string) {
    super(message);
    this.name = 'AccountError';
    this.code = code;
  }
}

/** Cambia el alias de una cuenta. No toca nada más. */
export async function renameAccount(db: SQLiteDatabase, accountId: number, alias: string): Promise<void> {
  const trimmed = alias.trim();
  if (!trimmed) throw new AccountError('alias_required', 'El alias no puede estar vacío.');

  const result = await db.runAsync('UPDATE accounts SET alias = ? WHERE id = ?', trimmed, accountId);
  if (result.changes === 0) throw new AccountError('not_found', 'La cuenta ya no existe.');
}

/**
 * Borra una cuenta (docs/modelo-datos.md): se van sus exports, mejoras y sugerencias;
 * las bases y ejércitos asociados pasan a account_id = NULL (disponibles para todas).
 *
 * Cada tabla se limpia de forma explícita y en orden, sin depender de ON DELETE, porque
 * la transacción exclusiva puede correr en otra conexión de SQLite.
 *
 * @returns Los IDs de notificación programados para sus mejoras, para que quien llama
 *   pueda cancelarlos.
 */
export async function deleteAccount(db: SQLiteDatabase, accountId: number): Promise<{ notificationIds: string[] }> {
  let notificationIds: string[] = [];

  await db.withExclusiveTransactionAsync(async (txn) => {
    const rows = await txn.getAllAsync<{ notification_id: string }>(
      'SELECT notification_id FROM active_upgrades WHERE account_id = ? AND notification_id IS NOT NULL',
      accountId,
    );
    notificationIds = rows.map((r) => r.notification_id);

    await txn.runAsync('UPDATE layouts SET account_id = NULL WHERE account_id = ?', accountId);
    await txn.runAsync('UPDATE armies SET account_id = NULL WHERE account_id = ?', accountId);
    await txn.runAsync('DELETE FROM active_upgrades WHERE account_id = ?', accountId);
    await txn.runAsync('UPDATE accounts SET last_export_id = NULL WHERE id = ?', accountId);
    await txn.runAsync('DELETE FROM exports WHERE account_id = ?', accountId);
    await txn.runAsync('DELETE FROM suggestions WHERE account_id = ?', accountId);

    const result = await txn.runAsync('DELETE FROM accounts WHERE id = ?', accountId);
    if (result.changes === 0) throw new AccountError('not_found', 'La cuenta ya no existe.');
  });

  return { notificationIds };
}

/** Activa o desactiva los avisos de una cuenta (F4). Después hay que sincronizar las notificaciones. */
export async function setNotificationsEnabled(db: SQLiteDatabase, accountId: number, enabled: boolean): Promise<void> {
  const result = await db.runAsync('UPDATE accounts SET notifications_on = ? WHERE id = ?', enabled ? 1 : 0, accountId);
  if (result.changes === 0) throw new AccountError('not_found', 'La cuenta ya no existe.');
}

/**
 * Guarda los recursos que escribió el usuario (null = no registrado) y la hora en que lo hizo.
 * La app no los puede leer del juego: el export no los trae.
 */
export async function setResources(db: SQLiteDatabase, accountId: number, resources: Resources, now: number): Promise<void> {
  for (const value of [resources.gold, resources.elixir, resources.dark]) {
    if (value !== null && (!Number.isInteger(value) || value < 0 || value > MAX_AMOUNT)) {
      throw new AccountError('invalid_amount', 'Las cantidades deben ser números enteros de 0 en adelante.');
    }
  }
  const result = await db.runAsync(
    'UPDATE accounts SET gold = ?, elixir = ?, dark_elixir = ?, resources_updated_at = ? WHERE id = ?',
    resources.gold,
    resources.elixir,
    resources.dark,
    now,
    accountId,
  );
  if (result.changes === 0) throw new AccountError('not_found', 'La cuenta ya no existe.');
}
