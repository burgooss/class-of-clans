import type { SQLiteDatabase } from 'expo-sqlite';

export type Account = {
  id: number;
  tag: string;
  alias: string;
  town_hall: number | null;
  builder_count: number | null;
  notifications_on: number;
  last_export_id: number | null;
  created_at: number;
  /** Recursos que escribió el usuario; null = no registrado. */
  gold: number | null;
  elixir: number | null;
  dark_elixir: number | null;
  /** Hora (epoch, segundos) en que los escribió. */
  resources_updated_at: number | null;
};

export type ActiveUpgrade = {
  id: number;
  account_id: number;
  export_id: number;
  slot_type: string;
  game_id: number;
  name: string | null;
  target_level: number | null;
  ends_at: number;
  notification_id: string | null;
};

export function getAccounts(db: SQLiteDatabase): Promise<Account[]> {
  return db.getAllAsync<Account>('SELECT * FROM accounts ORDER BY alias COLLATE NOCASE');
}

export function getAccount(db: SQLiteDatabase, id: number): Promise<Account | null> {
  return db.getFirstAsync<Account>('SELECT * FROM accounts WHERE id = ?', id);
}

export function getAccountByTag(db: SQLiteDatabase, tag: string): Promise<Account | null> {
  return db.getFirstAsync<Account>('SELECT * FROM accounts WHERE tag = ?', tag);
}

/** Mejoras de constructor de una cuenta, de la que termina antes a la que termina después. */
export function getBuilderUpgrades(db: SQLiteDatabase, accountId: number): Promise<ActiveUpgrade[]> {
  return db.getAllAsync<ActiveUpgrade>(
    "SELECT * FROM active_upgrades WHERE account_id = ? AND slot_type = 'builder' ORDER BY ends_at",
    accountId,
  );
}

/** Todas las mejoras en curso de una cuenta (constructores, laboratorio, mascotas…), por hora de fin. */
export function getUpgrades(db: SQLiteDatabase, accountId: number): Promise<ActiveUpgrade[]> {
  return db.getAllAsync<ActiveUpgrade>(
    'SELECT * FROM active_upgrades WHERE account_id = ? ORDER BY ends_at',
    accountId,
  );
}

/** Todas las mejoras en curso de todas las cuentas, de cualquier tipo de espacio. */
export function getAllUpgrades(db: SQLiteDatabase): Promise<ActiveUpgrade[]> {
  return db.getAllAsync<ActiveUpgrade>('SELECT * FROM active_upgrades ORDER BY ends_at');
}

/** Mejoras de constructor de todas las cuentas. */
export function getAllBuilderUpgrades(db: SQLiteDatabase): Promise<ActiveUpgrade[]> {
  return db.getAllAsync<ActiveUpgrade>(
    "SELECT * FROM active_upgrades WHERE slot_type = 'builder' ORDER BY ends_at",
  );
}

/** JSON crudo del último export de la cuenta, o null si no tiene. */
export async function getLastExportJson(db: SQLiteDatabase, accountId: number): Promise<string | null> {
  const row = await db.getFirstAsync<{ raw_json: string }>(
    `SELECT e.raw_json
       FROM accounts a JOIN exports e ON e.id = a.last_export_id
      WHERE a.id = ?`,
    accountId,
  );
  return row?.raw_json ?? null;
}

/** Hora (epoch, segundos) del último export de la cuenta, o null si no tiene. */
export async function getLastCapturedAt(db: SQLiteDatabase, accountId: number): Promise<number | null> {
  const row = await db.getFirstAsync<{ captured_at: number }>(
    `SELECT e.captured_at
       FROM accounts a JOIN exports e ON e.id = a.last_export_id
      WHERE a.id = ?`,
    accountId,
  );
  return row?.captured_at ?? null;
}
