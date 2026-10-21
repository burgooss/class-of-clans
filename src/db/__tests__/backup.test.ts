import { BACKUP_VERSION, parseBackup, TABLE_NAMES, TABLES } from '@/backup/format';
import { parseExport } from '@/export';

import { deleteAccount, renameAccount } from '../accounts';
import { createBackup, restoreBackup } from '../backup';
import { importExport } from '../imports';
import { addLink } from '../links';
import { migrateDb, SCHEMA_VERSION } from '../migrations';
import { createTestDb } from '../testing/nodeSqlite';
import { addSuggestion, setSuggestionStatus } from '../suggestions';

const T0 = 1_700_000_000;

function makeExport(tag: string, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    tag,
    timestamp: T0,
    buildings: [
      { data: 1000001, lvl: 9, cnt: 1 },
      { data: 1000015, lvl: 1, cnt: 3 },
      { data: 1000003, lvl: 6, timer: 600 },
    ],
    units: [{ data: 4000000, lvl: 2, timer: 300 }],
    ...extra,
  });
}

type Db = Awaited<ReturnType<typeof newDb>>;

async function newDb() {
  const db = createTestDb();
  await migrateDb(db);
  return db;
}

/** Base con datos en todas las tablas y con huecos en los ids (se borra una cuenta). */
async function populated() {
  const db = await newDb();
  const ids: number[] = [];
  for (const [i, tag] of ['#AAA111', '#BBB222', '#CCC333'].entries()) {
    const text = makeExport(tag, { timestamp: T0 + i });
    const r = await importExport(db, parseExport(text), text, { alias: `Cuenta ${i + 1}`, now: T0 + 10 });
    ids.push(r.accountId);
  }
  await deleteAccount(db, ids[1]);
  await renameAccount(db, ids[0], 'Principal ñandú');
  await db.runAsync('UPDATE accounts SET notifications_on = 0 WHERE id = ?', ids[2]);
  await db.runAsync('UPDATE active_upgrades SET notification_id = ?', 'notif-local');

  await addSuggestion(db, ids[0], { description: 'Torre', targetLevel: '10', notes: 'nota\ncon salto' }, T0);
  const s2 = await addSuggestion(db, ids[0], { description: 'Muro' }, T0);
  await setSuggestionStatus(db, s2, 'done');
  await addLink(db, 'layouts', { name: 'Base guerra', url: 'https://x.com/a?b=1&c=2', townHall: '14', category: 'trophy', accountId: ids[0] }, T0);
  await addLink(db, 'armies', { name: 'Ejército', url: 'https://x.com/e', category: 'farm' }, T0);
  return { db, ids };
}

async function dump(db: Db, withNotificationIds = false) {
  const out: Record<string, unknown[]> = {};
  for (const name of TABLE_NAMES) {
    const columns: string[] = TABLES[name].map((c) => c.name);
    if (withNotificationIds && name === 'active_upgrades') columns.push('notification_id');
    out[name] = await db.getAllAsync(`SELECT ${columns.join(', ')} FROM ${name} ORDER BY id`);
  }
  return out;
}

const roundTrip = async (db: Db) =>
  parseBackup(JSON.stringify(await createBackup(db, T0 + 99)), { schemaVersion: SCHEMA_VERSION });

describe('createBackup', () => {
  it('incluye todas las tablas con metadatos y sin notification_id', async () => {
    const { db } = await populated();
    const backup = await createBackup(db, T0 + 99);
    expect(backup).toMatchObject({ format: 'clash-builders-backup', version: BACKUP_VERSION, schemaVersion: SCHEMA_VERSION, exportedAt: T0 + 99 });
    expect(Object.keys(backup.tables)).toEqual(TABLE_NAMES);
    expect(backup.tables.accounts).toHaveLength(2);
    expect(backup.tables.suggestions).toHaveLength(2);
    expect(backup.tables.active_upgrades.every((u) => !('notification_id' in u))).toBe(true);
  });

  it('el respaldo de una base poblada pasa la validación', async () => {
    const { db } = await populated();
    await expect(roundTrip(db)).resolves.toBeDefined();
  });

  it('el respaldo de una base vacía también', async () => {
    await expect(roundTrip(await newDb())).resolves.toBeDefined();
  });
});

describe('restoreBackup', () => {
  it('restaura en una base vacía dejando todas las tablas idénticas (menos las notificaciones)', async () => {
    const { db: source } = await populated();
    const backup = await roundTrip(source);

    const target = await newDb();
    await restoreBackup(target, backup);

    expect(await dump(target)).toEqual(await dump(source));
    const ids = await target.getAllAsync<{ notification_id: string | null }>('SELECT notification_id FROM active_upgrades');
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((r) => r.notification_id === null)).toBe(true);
  });

  it('reemplaza por completo lo que hubiera, sin mezclar', async () => {
    const { db: source } = await populated();
    const backup = await roundTrip(source);

    const { db: target } = await populated();
    await target.runAsync("INSERT INTO accounts (tag, alias, created_at) VALUES ('#ZZZ999', 'Solo en destino', 1)");
    await restoreBackup(target, backup);

    expect(await dump(target)).toEqual(await dump(source));
    expect(await target.getFirstAsync('SELECT 1 FROM accounts WHERE tag = ?', '#ZZZ999')).toBeNull();
  });

  it('restaurar una base vacía borra todo', async () => {
    const { db } = await populated();
    await restoreBackup(db, await roundTrip(await newDb()));
    for (const name of TABLE_NAMES) expect(await db.getAllAsync(`SELECT id FROM ${name}`)).toEqual([]);
  });

  it('conserva las referencias y permite seguir usando la base', async () => {
    const { db: source, ids } = await populated();
    const target = await newDb();
    await restoreBackup(target, await roundTrip(source));

    const account = await target.getFirstAsync<{ last_export_id: number; alias: string }>('SELECT last_export_id, alias FROM accounts WHERE id = ?', ids[0]);
    expect(account?.alias).toBe('Principal ñandú');
    expect(
      await target.getFirstAsync('SELECT 1 FROM exports WHERE id = ? AND account_id = ?', account!.last_export_id, ids[0]),
    ).not.toBeNull();

    // Se puede seguir importando y creando filas sin chocar con los ids restaurados.
    const text = makeExport('#NEW000', { timestamp: T0 + 500 });
    const r = await importExport(target, parseExport(text), text, { alias: 'Nueva', now: T0 + 600 });
    expect(r.isNew).toBe(true);
    expect(r.accountId).toBeGreaterThan(Math.max(...ids));
    await expect(addSuggestion(target, ids[0], { description: 'Otra' }, T0)).resolves.toBeGreaterThan(0);
  });

  it('es idempotente: restaurar dos veces da lo mismo', async () => {
    const { db: source } = await populated();
    const backup = await roundTrip(source);
    const target = await newDb();
    await restoreBackup(target, backup);
    const once = await dump(target);
    await restoreBackup(target, backup);
    expect(await dump(target)).toEqual(once);
  });

  it('si falla a mitad, deja los datos como estaban', async () => {
    const { db: source } = await populated();
    const backup = await roundTrip(source);
    // Pasa la validación de formato pero viola NOT NULL en la base: falla después de borrar todo.
    const broken = structuredClone(backup);
    broken.tables.layouts[0].created_at = null;

    const { db: target } = await populated();
    const before = await dump(target, true);

    await expect(restoreBackup(target, broken)).rejects.toThrow();

    expect(await dump(target, true)).toEqual(before);
  });
});
