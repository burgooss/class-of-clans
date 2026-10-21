// Adaptador SOLO PARA PRUEBAS: expone sobre `node:sqlite` el subconjunto de la API de
// expo-sqlite que usa la app, para probar el SQL real sin un teléfono.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

type Params = unknown[];

function flatten(params: Params): SQLInputValue[] {
  const list = params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
  return list as SQLInputValue[];
}

export function createTestDb(): SQLiteDatabase {
  const db = new DatabaseSync(':memory:');

  const adapter = {
    async execAsync(source: string) {
      db.exec(source);
    },
    async runAsync(source: string, ...params: Params) {
      const result = db.prepare(source).run(...flatten(params));
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async getFirstAsync(source: string, ...params: Params) {
      return db.prepare(source).get(...flatten(params)) ?? null;
    },
    async getAllAsync(source: string, ...params: Params) {
      return db.prepare(source).all(...flatten(params));
    },
    async withExclusiveTransactionAsync(task: (txn: unknown) => Promise<void>): Promise<void> {
      db.exec('BEGIN');
      try {
        await task(adapter);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };

  return adapter as unknown as SQLiteDatabase;
}
