import type { SQLiteDatabase } from 'expo-sqlite';

import type { ParsedExport } from '@/export';

/** Cuántos exports crudos se conservan por cuenta (docs/modelo-datos.md). */
export const MAX_EXPORTS_PER_ACCOUNT = 10;

export type ImportErrorCode = 'alias_required' | 'stale_export';

export class ImportError extends Error {
  readonly code: ImportErrorCode;

  constructor(code: ImportErrorCode, message: string) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
  }
}

export type ImportResult = {
  accountId: number;
  isNew: boolean;
  upgradeCount: number;
};

/**
 * Guarda un export ya parseado (F1). Todo ocurre en una transacción: si algo falla,
 * no cambia nada.
 *
 * - Tag nuevo: crea la cuenta; exige `alias`.
 * - Tag existente: actualiza la cuenta y reemplaza sus mejoras activas.
 * - Un export más antiguo que el último importado de esa cuenta se rechaza, para no
 *   pisar datos recientes con un portapapeles viejo.
 *
 * @param rawJson Texto exacto del portapapeles; se guarda para poder re-procesarlo.
 * @param now Hora del import (epoch, segundos).
 */
export async function importExport(
  db: SQLiteDatabase,
  parsed: ParsedExport,
  rawJson: string,
  options: { alias?: string; now: number },
): Promise<ImportResult> {
  const { now } = options;
  let result: ImportResult | undefined;

  // withExclusiveTransactionAsync devuelve void, por eso el resultado sale en una variable.
  await db.withExclusiveTransactionAsync(async (txn) => {
    const existing = await txn.getFirstAsync<{ id: number; captured_at: number | null }>(
      `SELECT a.id, e.captured_at
         FROM accounts a LEFT JOIN exports e ON e.id = a.last_export_id
        WHERE a.tag = ?`,
      parsed.tag,
    );

    if (existing?.captured_at != null && parsed.capturedAt < existing.captured_at) {
      throw new ImportError(
        'stale_export',
        'Este export es más antiguo que el último que importaste de esta cuenta. No se cambió nada.',
      );
    }

    let accountId: number;
    if (existing) {
      accountId = existing.id;
    } else {
      const alias = options.alias?.trim();
      if (!alias) {
        throw new ImportError('alias_required', 'Hace falta un alias para la cuenta nueva.');
      }
      const created = await txn.runAsync(
        'INSERT INTO accounts (tag, alias, created_at) VALUES (?, ?, ?)',
        parsed.tag,
        alias,
        now,
      );
      accountId = created.lastInsertRowId;
    }

    const exportRow = await txn.runAsync(
      'INSERT INTO exports (account_id, captured_at, imported_at, raw_json) VALUES (?, ?, ?, ?)',
      accountId,
      parsed.capturedAt,
      now,
      rawJson,
    );
    const exportId = exportRow.lastInsertRowId;

    await txn.runAsync(
      'UPDATE accounts SET town_hall = ?, builder_count = ?, last_export_id = ? WHERE id = ?',
      parsed.townHall,
      parsed.builderCount,
      exportId,
      accountId,
    );

    await txn.runAsync('DELETE FROM active_upgrades WHERE account_id = ?', accountId);
    for (const upgrade of parsed.upgrades) {
      await txn.runAsync(
        `INSERT INTO active_upgrades
           (account_id, export_id, slot_type, game_id, name, target_level, ends_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`,
        accountId,
        exportId,
        upgrade.slotType,
        upgrade.gameId,
        upgrade.level,
        upgrade.endsAt,
      );
    }

    await txn.runAsync(
      `DELETE FROM exports
        WHERE account_id = ?
          AND id NOT IN (SELECT id FROM exports WHERE account_id = ? ORDER BY id DESC LIMIT ?)`,
      accountId,
      accountId,
      MAX_EXPORTS_PER_ACCOUNT,
    );

    result = { accountId, isNew: !existing, upgradeCount: parsed.upgrades.length };
  });

  if (!result) throw new Error('La transacción de importación no devolvió resultado.');
  return result;
}
