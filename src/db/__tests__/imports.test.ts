import { parseExport } from '@/export';

import { ImportError, importExport, MAX_EXPORTS_PER_ACCOUNT } from '../imports';
import { migrateDb, SCHEMA_VERSION } from '../migrations';
import { getAccountByTag, getAllBuilderUpgrades, getBuilderUpgrades, getLastCapturedAt } from '../queries';
import { createTestDb } from '../testing/nodeSqlite';

const T0 = 1_700_000_000;

function makeExport(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    tag: '#ABC123',
    timestamp: T0,
    buildings: [
      { data: 1000001, lvl: 9, cnt: 1 },
      { data: 1000015, lvl: 1, cnt: 1 },
      { data: 1000003, lvl: 6, timer: 600 },
      { data: 1000004, lvl: 3, timer: 1200 },
    ],
    units: [{ data: 4000000, lvl: 2, timer: 300 }],
    ...overrides,
  });
}

async function setup() {
  const db = createTestDb();
  await migrateDb(db);
  return db;
}

async function run(db: Awaited<ReturnType<typeof setup>>, text: string, alias?: string, now = T0 + 5) {
  return importExport(db, parseExport(text), text, { alias, now });
}

describe('migrateDb', () => {
  it('crea las tablas y es idempotente', async () => {
    const db = await setup();
    await migrateDb(db);
    const tables = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual([
      'accounts',
      'active_upgrades',
      'armies',
      'exports',
      'layouts',
      'suggestions',
    ]);
    const v = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(v?.user_version).toBe(SCHEMA_VERSION);
  });
});

describe('migraciones sobre una base con datos', () => {
  async function oldDb(version: number) {
    const db = createTestDb();
    await migrateDb(db, version);
    await db.runAsync("INSERT INTO accounts (tag, alias, created_at) VALUES ('#OLD111', 'Vieja', 1)");
    await db.runAsync('INSERT INTO exports (account_id, captured_at, imported_at, raw_json) VALUES (1, 1, 1, ?)', '{}');
    for (const level of [6, null]) {
      await db.runAsync(
        "INSERT INTO active_upgrades (account_id, export_id, slot_type, game_id, target_level, ends_at) VALUES (1, 1, 'builder', 1000003, ?, 99)",
        level,
      );
    }
    await db.runAsync("INSERT INTO suggestions (account_id, description, position, created_at) VALUES (1, 'Torre', 1, 1)");
    return db;
  }

  const levels = async (db: Awaited<ReturnType<typeof oldDb>>) =>
    (await db.getAllAsync<{ target_level: number | null }>('SELECT target_level FROM active_upgrades ORDER BY id')).map((r) => r.target_level);

  it('la migración 2 suma 1 a los niveles guardados con la semántica anterior', async () => {
    const db = await oldDb(1);
    expect(await levels(db)).toEqual([6, null]);

    await migrateDb(db);

    expect(await levels(db)).toEqual([7, null]);
    expect((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version).toBe(SCHEMA_VERSION);
  });

  it('migrar de nuevo no vuelve a sumar', async () => {
    const db = await oldDb(1);
    await migrateDb(db);
    await migrateDb(db);
    expect(await levels(db)).toEqual([7, null]);
  });

  it('la migración 3 agrega recursos y game_id vacíos sin tocar lo que ya había', async () => {
    const db = await oldDb(2);
    await migrateDb(db);

    const account = await db.getFirstAsync<Record<string, unknown>>('SELECT alias, gold, elixir, dark_elixir, resources_updated_at FROM accounts');
    expect(account).toEqual({ alias: 'Vieja', gold: null, elixir: null, dark_elixir: null, resources_updated_at: null });
    const suggestion = await db.getFirstAsync<Record<string, unknown>>('SELECT description, game_id FROM suggestions');
    expect(suggestion).toEqual({ description: 'Torre', game_id: null });
    expect(await levels(db)).toEqual([6, null]); // la migración 3 no toca los niveles
  });
});

describe('importExport: cuenta nueva', () => {
  it('crea la cuenta, guarda el JSON crudo y las mejoras', async () => {
    const db = await setup();
    const text = makeExport();
    const result = await run(db, text, '  Principal  ');

    expect(result).toMatchObject({ isNew: true, upgradeCount: 3 });

    const account = await getAccountByTag(db, '#ABC123');
    expect(account).toMatchObject({
      alias: 'Principal',
      town_hall: 9,
      builder_count: 1,
      notifications_on: 1,
      created_at: T0 + 5,
    });
    expect(account?.last_export_id).not.toBeNull();

    const exp = await db.getFirstAsync<{ raw_json: string; captured_at: number; imported_at: number }>(
      'SELECT raw_json, captured_at, imported_at FROM exports WHERE id = ?',
      account!.last_export_id!,
    );
    expect(exp).toEqual({ raw_json: text, captured_at: T0, imported_at: T0 + 5 });

    const builder = await getBuilderUpgrades(db, result.accountId);
    expect(builder.map((u) => [u.game_id, u.ends_at, u.target_level])).toEqual([
      [1000003, T0 + 600, 7],
      [1000004, T0 + 1200, 4],
    ]);
    expect(await getLastCapturedAt(db, result.accountId)).toBe(T0);
  });

  it('guarda también las mejoras que no son de constructor', async () => {
    const db = await setup();
    await run(db, makeExport(), 'Principal');
    const lab = await db.getAllAsync<{ slot_type: string }>(
      "SELECT slot_type FROM active_upgrades WHERE slot_type <> 'builder'",
    );
    expect(lab).toEqual([{ slot_type: 'lab' }]);
  });

  it('exige alias y no crea nada sin él', async () => {
    const db = await setup();
    for (const alias of [undefined, '', '   ']) {
      await expect(run(db, makeExport(), alias)).rejects.toMatchObject({ code: 'alias_required' });
    }
    expect(await db.getAllAsync('SELECT * FROM accounts')).toEqual([]);
    expect(await db.getAllAsync('SELECT * FROM exports')).toEqual([]);
  });
});

describe('importExport: fallo a mitad de la transacción', () => {
  it('deshace todo si falla al guardar una mejora', async () => {
    const db = await setup();
    const parsed = parseExport(makeExport());
    // endsAt nulo viola NOT NULL después de haber creado cuenta y export.
    const broken = { ...parsed, upgrades: [{ ...parsed.upgrades[0], endsAt: null as unknown as number }] };

    await expect(importExport(db, broken, '{}', { alias: 'Principal', now: T0 })).rejects.toThrow();

    expect(await db.getAllAsync('SELECT * FROM accounts')).toEqual([]);
    expect(await db.getAllAsync('SELECT * FROM exports')).toEqual([]);
    expect(await db.getAllAsync('SELECT * FROM active_upgrades')).toEqual([]);
  });

  it('no pierde las mejoras anteriores si la reimportación falla', async () => {
    const db = await setup();
    await run(db, makeExport(), 'Principal');
    const before = await db.getAllAsync('SELECT * FROM active_upgrades');

    const parsed = parseExport(makeExport({ timestamp: T0 + 100 }));
    const broken = { ...parsed, upgrades: [{ ...parsed.upgrades[0], endsAt: null as unknown as number }] };
    await expect(importExport(db, broken, '{}', { now: T0 + 105 })).rejects.toThrow();

    expect(await db.getAllAsync('SELECT * FROM active_upgrades')).toEqual(before);
    expect((await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM exports'))?.n).toBe(1);
  });
});

describe('importExport: cuenta existente', () => {
  it('reemplaza las mejoras activas y conserva alias y notificaciones', async () => {
    const db = await setup();
    const first = await run(db, makeExport(), 'Principal');
    await db.runAsync('UPDATE accounts SET notifications_on = 0 WHERE id = ?', first.accountId);

    const second = await run(
      db,
      makeExport({
        timestamp: T0 + 1000,
        buildings: [
          { data: 1000001, lvl: 10, cnt: 1 },
          { data: 1000015, lvl: 1, cnt: 2 },
          { data: 1000005, lvl: 2, timer: 50 },
        ],
        units: [],
      }),
      'Otro alias ignorado',
      T0 + 1005,
    );

    expect(second).toMatchObject({ accountId: first.accountId, isNew: false, upgradeCount: 1 });
    const account = await getAccountByTag(db, '#ABC123');
    expect(account).toMatchObject({ alias: 'Principal', town_hall: 10, builder_count: 2, notifications_on: 0 });

    const all = await db.getAllAsync<{ game_id: number }>('SELECT game_id FROM active_upgrades');
    expect(all).toEqual([{ game_id: 1000005 }]);
    expect(await getLastCapturedAt(db, first.accountId)).toBe(T0 + 1000);
  });

  it('no mezcla las mejoras de cuentas distintas', async () => {
    const db = await setup();
    await run(db, makeExport(), 'Una');
    await run(db, makeExport({ tag: '#XYZ789' }), 'Otra');
    expect(await getAllBuilderUpgrades(db)).toHaveLength(4);
    await run(db, makeExport({ timestamp: T0 + 10, units: [], buildings: [{ data: 1000001, lvl: 9 }] }));
    expect(await getAllBuilderUpgrades(db)).toHaveLength(2);
  });

  it('rechaza un export más antiguo sin cambiar nada', async () => {
    const db = await setup();
    await run(db, makeExport({ timestamp: T0 + 500 }), 'Principal');
    const before = await db.getAllAsync('SELECT * FROM active_upgrades');

    const error = await run(db, makeExport({ timestamp: T0, units: [] })).catch((e) => e);
    expect(error).toBeInstanceOf(ImportError);
    expect(error.code).toBe('stale_export');

    expect(await db.getAllAsync('SELECT * FROM active_upgrades')).toEqual(before);
    expect((await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM exports'))?.n).toBe(1);
  });

  it('acepta reimportar el mismo export', async () => {
    const db = await setup();
    await run(db, makeExport(), 'Principal');
    await expect(run(db, makeExport())).resolves.toMatchObject({ isNew: false, upgradeCount: 3 });
    expect(await getAllBuilderUpgrades(db)).toHaveLength(2);
  });

  it('conserva solo los últimos exports de cada cuenta', async () => {
    const db = await setup();
    await run(db, makeExport({ timestamp: T0 }), 'Principal');
    for (let i = 1; i <= MAX_EXPORTS_PER_ACCOUNT + 3; i++) {
      await run(db, makeExport({ timestamp: T0 + i }));
    }
    const rows = await db.getAllAsync<{ captured_at: number }>('SELECT captured_at FROM exports ORDER BY id');
    expect(rows).toHaveLength(MAX_EXPORTS_PER_ACCOUNT);
    expect(rows[rows.length - 1].captured_at).toBe(T0 + MAX_EXPORTS_PER_ACCOUNT + 3);
    expect(await getLastCapturedAt(db, 1)).toBe(T0 + MAX_EXPORTS_PER_ACCOUNT + 3);
    expect(await getAllBuilderUpgrades(db)).toHaveLength(2);
  });

  it('borrar la cuenta borra en cascada sus exports y mejoras', async () => {
    const db = await setup();
    const { accountId } = await run(db, makeExport(), 'Principal');
    await db.runAsync('DELETE FROM accounts WHERE id = ?', accountId);
    expect(await db.getAllAsync('SELECT * FROM exports')).toEqual([]);
    expect(await db.getAllAsync('SELECT * FROM active_upgrades')).toEqual([]);
  });
});
