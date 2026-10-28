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
  // 2: `target_level` guardaba el `lvl` del export, que es el nivel ACTUAL; ahora guarda el
  // nivel destino (lvl + 1). Solo corrige filas existentes: las nuevas ya se guardan bien.
  `
  UPDATE active_upgrades SET target_level = target_level + 1 WHERE target_level IS NOT NULL;
  `,
  // 3: recursos que escribe el usuario (null = no registrado) y elemento del catálogo en las
  // sugerencias, para calcular su costo.
  `
  ALTER TABLE accounts ADD COLUMN gold INTEGER;
  ALTER TABLE accounts ADD COLUMN elixir INTEGER;
  ALTER TABLE accounts ADD COLUMN dark_elixir INTEGER;
  ALTER TABLE accounts ADD COLUMN resources_updated_at INTEGER;
  ALTER TABLE suggestions ADD COLUMN game_id INTEGER;
  `,
  // 4: las mejoras de trampas se guardaban como 'other' y no contaban como constructor ocupado.
  // Las trampas de la aldea principal tienen IDs 12000000-12999999 (las de la base del constructor
  // se guardan como 'builder_base', no como 'other'). Las mejoras nuevas ya se guardan bien.
  `
  UPDATE active_upgrades SET slot_type = 'builder'
   WHERE slot_type = 'other' AND game_id >= 12000000 AND game_id < 13000000;
  `,
];

/** Versión actual del esquema (PRAGMA user_version tras migrar). */
export const SCHEMA_VERSION = MIGRATIONS.length;

/**
 * Lleva la base a la última versión del esquema. `upTo` (solo para pruebas) detiene la migración
 * en una versión anterior para simular una base vieja.
 */
export async function migrateDb(db: SQLiteDatabase, upTo: number = MIGRATIONS.length): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let version = current; version < upTo; version++) {
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.execAsync(MIGRATIONS[version]);
      await txn.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
