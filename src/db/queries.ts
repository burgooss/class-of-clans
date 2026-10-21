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
};

export function getAccounts(db: SQLiteDatabase): Promise<Account[]> {
  return db.getAllAsync<Account>('SELECT * FROM accounts ORDER BY alias COLLATE NOCASE');
}

export function getAccount(db: SQLiteDatabase, id: number): Promise<Account | null> {
  return db.getFirstAsync<Account>('SELECT * FROM accounts WHERE id = ?', id);
}
