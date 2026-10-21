import type { SQLiteDatabase } from 'expo-sqlite';

export type AccountErrorCode = 'alias_required' | 'not_found';

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
