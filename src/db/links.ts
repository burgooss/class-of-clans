import type { SQLiteDatabase } from 'expo-sqlite';

import { type Collection, COLLECTIONS, type LinkCategory, parseLinkUrl, parseTownHall } from '@/domain/links';

/** Una base o un ejército guardado. `category` es `kind` en bases y `purpose` en ejércitos. */
export type SavedLink = {
  id: number;
  account_id: number | null;
  name: string;
  url: string;
  town_hall: number | null;
  category: LinkCategory;
  notes: string | null;
  created_at: number;
};

export type LinkInput = {
  name: string;
  url: string;
  /** Texto tal como lo escribió el usuario; vacío significa sin ayuntamiento. */
  townHall?: string;
  category: LinkCategory;
  /** null o ausente = disponible para todas las cuentas. */
  accountId?: number | null;
  notes?: string;
};

export type LinkErrorCode =
  | 'name_required'
  | 'invalid_url'
  | 'invalid_town_hall'
  | 'invalid_category'
  | 'invalid_account'
  | 'not_found';

export class LinkError extends Error {
  readonly code: LinkErrorCode;

  constructor(code: LinkErrorCode, message: string) {
    super(message);
    this.name = 'LinkError';
    this.code = code;
  }
}

type Clean = {
  name: string;
  url: string;
  townHall: number | null;
  category: LinkCategory;
  accountId: number | null;
  notes: string | null;
};

// Valida y normaliza la entrada. Los nombres de tabla y columna salen de COLLECTIONS, nunca del usuario.
async function validate(db: SQLiteDatabase, collection: Collection, input: LinkInput): Promise<Clean> {
  const name = input.name.trim();
  if (!name) throw new LinkError('name_required', 'Escribe un nombre.');

  const url = parseLinkUrl(input.url);
  if (!url.ok) throw new LinkError('invalid_url', 'El link no es válido. Debe empezar con http:// o https://.');

  const townHall = parseTownHall(input.townHall ?? '');
  if (!townHall.ok) throw new LinkError('invalid_town_hall', 'El ayuntamiento debe ser un número entre 1 y 30.');

  if (!COLLECTIONS[collection].categories.includes(input.category)) {
    throw new LinkError('invalid_category', 'La categoría no es válida.');
  }

  const accountId = input.accountId ?? null;
  if (accountId !== null) {
    const account = await db.getFirstAsync<{ id: number }>('SELECT id FROM accounts WHERE id = ?', accountId);
    if (!account) throw new LinkError('invalid_account', 'La cuenta ya no existe.');
  }

  return {
    name,
    url: url.url,
    townHall: townHall.value,
    category: input.category,
    accountId,
    notes: input.notes?.trim() || null,
  };
}

/** Todo lo guardado en la colección, lo más reciente primero. El filtrado se hace en pantalla. */
export function getLinks(db: SQLiteDatabase, collection: Collection): Promise<SavedLink[]> {
  const { table, column } = COLLECTIONS[collection];
  return db.getAllAsync<SavedLink>(
    `SELECT id, account_id, name, url, town_hall, ${column} AS category, notes, created_at
       FROM ${table} ORDER BY id DESC`,
  );
}

export async function addLink(db: SQLiteDatabase, collection: Collection, input: LinkInput, now: number): Promise<number> {
  const clean = await validate(db, collection, input);
  const { table, column } = COLLECTIONS[collection];
  const result = await db.runAsync(
    `INSERT INTO ${table} (account_id, name, url, town_hall, ${column}, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    clean.accountId,
    clean.name,
    clean.url,
    clean.townHall,
    clean.category,
    clean.notes,
    now,
  );
  return result.lastInsertRowId;
}

export async function updateLink(db: SQLiteDatabase, collection: Collection, id: number, input: LinkInput): Promise<void> {
  const clean = await validate(db, collection, input);
  const { table, column } = COLLECTIONS[collection];
  const result = await db.runAsync(
    `UPDATE ${table}
        SET account_id = ?, name = ?, url = ?, town_hall = ?, ${column} = ?, notes = ?
      WHERE id = ?`,
    clean.accountId,
    clean.name,
    clean.url,
    clean.townHall,
    clean.category,
    clean.notes,
    id,
  );
  if (result.changes === 0) throw new LinkError('not_found', 'Ya no existe.');
}

export async function deleteLink(db: SQLiteDatabase, collection: Collection, id: number): Promise<void> {
  const result = await db.runAsync(`DELETE FROM ${COLLECTIONS[collection].table} WHERE id = ?`, id);
  if (result.changes === 0) throw new LinkError('not_found', 'Ya no existe.');
}
