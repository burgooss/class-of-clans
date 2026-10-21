import type { SQLiteDatabase } from 'expo-sqlite';

// Cada elemento es una migración. El índice + 1 es la versión (PRAGMA user_version).
// Nunca editar una migración ya aplicada: agregar una nueva al final.
// Esquema descrito en docs/modelo-datos.md.
const MIGRATIONS: string[] = [
  `
  CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tag TEXT NOT NULL UNIQUE,
    alias TEXT NOT NULL,
    town_hall INTEGER,
    builder_count INTEGER,
    notifications_on INTEGER NOT NULL DEFAULT 1,
    last_export_id INTEGER REFERENCES exports(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    captured_at INTEGER NOT NULL,
    imported_at INTEGER NOT NULL,
    raw_json TEXT NOT NULL
  );
  CREATE INDEX idx_exports_account ON exports(account_id);

  CREATE TABLE active_upgrades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    export_id INTEGER NOT NULL REFERENCES exports(id) ON DELETE CASCADE,
    slot_type TEXT NOT NULL,
    game_id INTEGER NOT NULL,
    name TEXT,
    target_level INTEGER,
    ends_at INTEGER NOT NULL,
    notification_id TEXT
  );
  CREATE INDEX idx_upgrades_account ON active_upgrades(account_id);

  CREATE TABLE suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    target_level INTEGER,
    position INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'in_progress', 'done')),
    notes TEXT,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX idx_suggestions_account ON suggestions(account_id, position);

  CREATE TABLE layouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    town_hall INTEGER,
    kind TEXT NOT NULL DEFAULT 'other'
      CHECK (kind IN ('war', 'trophy', 'farm', 'other')),
    notes TEXT,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE armies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    town_hall INTEGER,
    purpose TEXT NOT NULL DEFAULT 'other'
      CHECK (purpose IN ('war', 'farm', 'other')),
    notes TEXT,
    created_at INTEGER NOT NULL
  );
  `,
];

/** Versión actual del esquema (PRAGMA user_version tras migrar). */
export const SCHEMA_VERSION = MIGRATIONS.length;

export async function migrateDb(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(MIGRATIONS[version]);
      await txn.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
