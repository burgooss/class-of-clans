import type { SQLiteDatabase } from 'expo-sqlite';

import { type Backup, BACKUP_FORMAT, BACKUP_VERSION, type Row, TABLE_NAMES, TABLES, type TableName } from '@/backup/format';

import { SCHEMA_VERSION } from './migrations';

/** Lee toda la base y arma el respaldo (F8). `now` es la hora del respaldo (epoch, segundos). */
export async function createBackup(db: SQLiteDatabase, now: number): Promise<Backup> {
  const tables = {} as Record<TableName, Row[]>;
  for (const name of TABLE_NAMES) {
    const columns = TABLES[name].map((c) => c.name).join(', ');
    tables[name] = await db.getAllAsync<Row>(`SELECT ${columns} FROM ${name} ORDER BY id`);
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, schemaVersion: SCHEMA_VERSION, exportedAt: now, tables };
}

async function insertRows(db: SQLiteDatabase, name: TableName, rows: Row[], skip: string[] = []): Promise<void> {
  const columns = TABLES[name].map((c) => c.name).filter((c) => !skip.includes(c));
  const sql = `INSERT INTO ${name} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
  for (const row of rows) {
    await db.runAsync(
      sql,
      columns.map((c) => row[c]),
    );
  }
}

/**
 * Reemplaza TODOS los datos de la app por los del respaldo, en una sola transacción: si algo
 * falla, queda todo como estaba. El respaldo debe venir de `parseBackup` (ya validado).
 *
 * Las notificaciones no se restauran (son del teléfono): hay que sincronizarlas después.
 * Se conservan los IDs, así que las referencias entre tablas siguen válidas.
 */
export async function restoreBackup(db: SQLiteDatabase, backup: Backup): Promise<void> {
  const { tables } = backup;

  await db.withExclusiveTransactionAsync(async (txn) => {
    // Vaciar en orden de dependencias, sin depender de ON DELETE.
    await txn.runAsync('UPDATE accounts SET last_export_id = NULL');
    for (const name of ['active_upgrades', 'suggestions', 'layouts', 'armies', 'exports', 'accounts'] as const) {
      await txn.runAsync(`DELETE FROM ${name}`);
    }

    // accounts.last_export_id apunta a exports, que apunta a accounts: se llena al final.
    await insertRows(txn, 'accounts', tables.accounts, ['last_export_id']);
    await insertRows(txn, 'exports', tables.exports);
    for (const account of tables.accounts) {
      if (account.last_export_id !== null) {
        await txn.runAsync('UPDATE accounts SET last_export_id = ? WHERE id = ?', account.last_export_id, account.id);
      }
    }
    await insertRows(txn, 'active_upgrades', tables.active_upgrades);
    await insertRows(txn, 'suggestions', tables.suggestions);
    await insertRows(txn, 'layouts', tables.layouts);
    await insertRows(txn, 'armies', tables.armies);
  });
}
