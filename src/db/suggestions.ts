import type { SQLiteDatabase } from 'expo-sqlite';

import { moveWithin, parseTargetLevel, type SuggestionStatus } from '@/domain/suggestions';

export type Suggestion = {
  id: number;
  account_id: number;
  description: string;
  target_level: number | null;
  position: number;
  status: SuggestionStatus;
  notes: string | null;
  created_at: number;
};

export type SuggestionInput = {
  description: string;
  /** Texto tal como lo escribió el usuario; vacío significa sin nivel. */
  targetLevel?: string;
  notes?: string;
  /** Solo al editar. Al crear siempre empieza como pendiente. */
  status?: SuggestionStatus;
};

export type SuggestionErrorCode = 'description_required' | 'invalid_level' | 'not_found';

export class SuggestionError extends Error {
  readonly code: SuggestionErrorCode;

  constructor(code: SuggestionErrorCode, message: string) {
    super(message);
    this.name = 'SuggestionError';
    this.code = code;
  }
}

function validate(input: SuggestionInput): { description: string; targetLevel: number | null; notes: string | null } {
  const description = input.description.trim();
  if (!description) throw new SuggestionError('description_required', 'Escribe una descripción.');

  const level = parseTargetLevel(input.targetLevel ?? '');
  if (!level.ok) throw new SuggestionError('invalid_level', 'El nivel objetivo debe ser un número entre 1 y 999.');

  const notes = input.notes?.trim() || null;
  return { description, targetLevel: level.value, notes };
}

/** Cola de una cuenta, en el orden que armó el usuario. */
export function getSuggestions(db: SQLiteDatabase, accountId: number): Promise<Suggestion[]> {
  return db.getAllAsync<Suggestion>(
    'SELECT * FROM suggestions WHERE account_id = ? ORDER BY position, id',
    accountId,
  );
}

/** Agrega una sugerencia al final de la cola, como pendiente. */
export async function addSuggestion(
  db: SQLiteDatabase,
  accountId: number,
  input: SuggestionInput,
  now: number,
): Promise<number> {
  const { description, targetLevel, notes } = validate(input);
  const last = await db.getFirstAsync<{ max_position: number | null }>(
    'SELECT MAX(position) AS max_position FROM suggestions WHERE account_id = ?',
    accountId,
  );
  const result = await db.runAsync(
    `INSERT INTO suggestions (account_id, description, target_level, position, status, notes, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?, ?)`,
    accountId,
    description,
    targetLevel,
    (last?.max_position ?? 0) + 1,
    notes,
    now,
  );
  return result.lastInsertRowId;
}

/** Edita descripción, nivel, notas y (si se indica) estado. No cambia su lugar en la cola. */
export async function updateSuggestion(db: SQLiteDatabase, id: number, input: SuggestionInput): Promise<void> {
  const { description, targetLevel, notes } = validate(input);
  const result = input.status
    ? await db.runAsync(
        'UPDATE suggestions SET description = ?, target_level = ?, notes = ?, status = ? WHERE id = ?',
        description,
        targetLevel,
        notes,
        input.status,
        id,
      )
    : await db.runAsync(
        'UPDATE suggestions SET description = ?, target_level = ?, notes = ? WHERE id = ?',
        description,
        targetLevel,
        notes,
        id,
      );
  if (result.changes === 0) throw new SuggestionError('not_found', 'La sugerencia ya no existe.');
}

export async function setSuggestionStatus(db: SQLiteDatabase, id: number, status: SuggestionStatus): Promise<void> {
  const result = await db.runAsync('UPDATE suggestions SET status = ? WHERE id = ?', status, id);
  if (result.changes === 0) throw new SuggestionError('not_found', 'La sugerencia ya no existe.');
}

/** Borra una sugerencia y deja las posiciones de la cola consecutivas. */
export async function deleteSuggestion(db: SQLiteDatabase, id: number): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const row = await txn.getFirstAsync<{ account_id: number }>('SELECT account_id FROM suggestions WHERE id = ?', id);
    if (!row) throw new SuggestionError('not_found', 'La sugerencia ya no existe.');
    await txn.runAsync('DELETE FROM suggestions WHERE id = ?', id);
    await renumber(txn, row.account_id);
  });
}

/**
 * Sube o baja una sugerencia una posición. Con `hideDone` salta las hechas, que no se ven.
 * @returns false si no se pudo mover (ya está en el extremo).
 */
export async function moveSuggestion(
  db: SQLiteDatabase,
  id: number,
  direction: 'up' | 'down',
  options: { hideDone: boolean },
): Promise<boolean> {
  let moved = false;
  await db.withExclusiveTransactionAsync(async (txn) => {
    const row = await txn.getFirstAsync<{ account_id: number }>('SELECT account_id FROM suggestions WHERE id = ?', id);
    if (!row) throw new SuggestionError('not_found', 'La sugerencia ya no existe.');

    const list = await txn.getAllAsync<{ id: number; status: SuggestionStatus }>(
      'SELECT id, status FROM suggestions WHERE account_id = ? ORDER BY position, id',
      row.account_id,
    );
    const order = moveWithin(
      list.map((s) => ({ id: s.id, hidden: options.hideDone && s.status === 'done' })),
      id,
      direction,
    );
    if (!order) return;

    for (const [index, suggestionId] of order.entries()) {
      await txn.runAsync('UPDATE suggestions SET position = ? WHERE id = ?', index + 1, suggestionId);
    }
    moved = true;
  });
  return moved;
}

// Reescribe las posiciones como 1..n conservando el orden actual.
async function renumber(db: SQLiteDatabase, accountId: number): Promise<void> {
  const rows = await db.getAllAsync<{ id: number }>(
    'SELECT id FROM suggestions WHERE account_id = ? ORDER BY position, id',
    accountId,
  );
  for (const [index, row] of rows.entries()) {
    await db.runAsync('UPDATE suggestions SET position = ? WHERE id = ?', index + 1, row.id);
  }
}
