import { parseExport } from '@/export';

import { AccountError, deleteAccount, renameAccount, setResources } from '../accounts';
import { importExport } from '../imports';
import { migrateDb } from '../migrations';
import { createTestDb } from '../testing/nodeSqlite';

const T0 = 1_700_000_000;

function makeExport(tag: string): string {
  return JSON.stringify({
    tag,
    timestamp: T0,
    buildings: [
      { data: 1000001, lvl: 9, cnt: 1 },
      { data: 1000003, lvl: 6, timer: 600 },
    ],
  });
}

async function setup(foreignKeys: 'ON' | 'OFF' = 'ON') {
  const db = createTestDb();
  await migrateDb(db);
  await db.execAsync(`PRAGMA foreign_keys = ${foreignKeys}`);

  const ids: number[] = [];
  for (const [i, tag] of ['#AAA111', '#BBB222'].entries()) {
    const text = makeExport(tag);
    const { accountId } = await importExport(db, parseExport(text), text, { alias: `Cuenta ${i}`, now: T0 });
    ids.push(accountId);
    await db.runAsync(
      "INSERT INTO suggestions (account_id, description, position, created_at) VALUES (?, 'Mejorar algo', 1, ?)",
      accountId,
      T0,
    );
    await db.runAsync("UPDATE active_upgrades SET notification_id = ? WHERE account_id = ?", `notif-${accountId}`, accountId);
  }
  // Una base y un ejército asociados a la primera cuenta, y otros a la segunda.
  for (const accountId of ids) {
    await db.runAsync(
      "INSERT INTO layouts (account_id, name, url, created_at) VALUES (?, 'Base', 'https://link.clashofclans.com/x', ?)",
      accountId,
      T0,
    );
    await db.runAsync(
      "INSERT INTO armies (account_id, name, url, created_at) VALUES (?, 'Ejército', 'https://link.clashofclans.com/y', ?)",
      accountId,
      T0,
    );
  }
  return { db, ids };
}

const count = async (db: Awaited<ReturnType<typeof setup>>['db'], sql: string, ...p: number[]) =>
  (await db.getFirstAsync<{ n: number }>(sql, ...p))?.n;

describe('renameAccount', () => {
  it('cambia el alias (con espacios recortados) sin tocar lo demás', async () => {
    const { db, ids } = await setup();
    await renameAccount(db, ids[0], '  Granja TH12  ');
    const a = await db.getFirstAsync<{ alias: string; tag: string; town_hall: number }>(
      'SELECT alias, tag, town_hall FROM accounts WHERE id = ?',
      ids[0],
    );
    expect(a).toEqual({ alias: 'Granja TH12', tag: '#AAA111', town_hall: 9 });
    expect(await count(db, 'SELECT COUNT(*) AS n FROM active_upgrades')).toBe(2);
  });

  it('rechaza un alias vacío y conserva el anterior', async () => {
    const { db, ids } = await setup();
    for (const alias of ['', '   ']) {
      await expect(renameAccount(db, ids[0], alias)).rejects.toMatchObject({ code: 'alias_required' });
    }
    expect((await db.getFirstAsync<{ alias: string }>('SELECT alias FROM accounts WHERE id = ?', ids[0]))?.alias).toBe('Cuenta 0');
  });

  it('avisa si la cuenta no existe', async () => {
    const { db } = await setup();
    await expect(renameAccount(db, 999, 'X')).rejects.toBeInstanceOf(AccountError);
    await expect(renameAccount(db, 999, 'X')).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('setResources', () => {
  const row = async (db: Awaited<ReturnType<typeof setup>>['db'], id: number) =>
    db.getFirstAsync<Record<string, unknown>>('SELECT gold, elixir, dark_elixir, resources_updated_at FROM accounts WHERE id = ?', id);

  it('guarda los recursos y la hora en que se escribieron', async () => {
    const { db, ids } = await setup();
    await setResources(db, ids[0], { gold: 1_500_000, elixir: 0, dark: 85_000 }, T0 + 50);
    expect(await row(db, ids[0])).toEqual({ gold: 1_500_000, elixir: 0, dark_elixir: 85_000, resources_updated_at: T0 + 50 });
  });

  it('null deja un recurso como no registrado y 0 es un valor válido', async () => {
    const { db, ids } = await setup();
    await setResources(db, ids[0], { gold: 10, elixir: 20, dark: 30 }, T0);
    await setResources(db, ids[0], { gold: null, elixir: 0, dark: null }, T0 + 1);
    expect(await row(db, ids[0])).toEqual({ gold: null, elixir: 0, dark_elixir: null, resources_updated_at: T0 + 1 });
  });

  it('no toca otras cuentas ni otros datos de la cuenta', async () => {
    const { db, ids } = await setup();
    await setResources(db, ids[0], { gold: 5, elixir: 5, dark: 5 }, T0);
    expect(await row(db, ids[1])).toEqual({ gold: null, elixir: null, dark_elixir: null, resources_updated_at: null });
    expect((await db.getFirstAsync<{ alias: string }>('SELECT alias FROM accounts WHERE id = ?', ids[0]))?.alias).toBe('Cuenta 0');
  });

  it.each([-1, 1.5, Number.NaN, 10_000_000_000])('rechaza %p sin cambiar nada', async (bad) => {
    const { db, ids } = await setup();
    await setResources(db, ids[0], { gold: 7, elixir: 7, dark: 7 }, T0);
    await expect(setResources(db, ids[0], { gold: bad, elixir: 1, dark: 1 }, T0 + 9)).rejects.toMatchObject({ code: 'invalid_amount' });
    expect(await row(db, ids[0])).toEqual({ gold: 7, elixir: 7, dark_elixir: 7, resources_updated_at: T0 });
  });

  it('avisa si la cuenta no existe', async () => {
    const { db } = await setup();
    await expect(setResources(db, 999, { gold: 1, elixir: 1, dark: 1 }, T0)).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe.each(['ON', 'OFF'] as const)('deleteAccount (claves foráneas %s)', (fk) => {
  it('borra la cuenta y sus datos, y deja libres sus bases y ejércitos', async () => {
    const { db, ids } = await setup(fk);
    const [target, other] = ids;

    const result = await deleteAccount(db, target);

    expect(result.notificationIds).toEqual([`notif-${target}`]);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM accounts WHERE id = ?', target)).toBe(0);
    for (const table of ['exports', 'active_upgrades', 'suggestions']) {
      expect(await count(db, `SELECT COUNT(*) AS n FROM ${table} WHERE account_id = ?`, target)).toBe(0);
    }
    // Bases y ejércitos se conservan, ahora para todas las cuentas.
    for (const table of ['layouts', 'armies']) {
      expect(await db.getAllAsync(`SELECT account_id FROM ${table} ORDER BY id`)).toEqual([
        { account_id: null },
        { account_id: other },
      ]);
    }
  });

  it('no toca a las demás cuentas', async () => {
    const { db, ids } = await setup(fk);
    await deleteAccount(db, ids[0]);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM accounts')).toBe(1);
    for (const table of ['exports', 'active_upgrades', 'suggestions']) {
      expect(await count(db, `SELECT COUNT(*) AS n FROM ${table} WHERE account_id = ?`, ids[1])).toBe(1);
    }
  });

  it('avisa si no existe y no cambia nada', async () => {
    const { db } = await setup(fk);
    await expect(deleteAccount(db, 999)).rejects.toMatchObject({ code: 'not_found' });
    expect(await count(db, 'SELECT COUNT(*) AS n FROM accounts')).toBe(2);
    expect(await count(db, 'SELECT COUNT(*) AS n FROM suggestions')).toBe(2);
  });

  it('permite volver a importar el mismo tag como cuenta nueva', async () => {
    const { db, ids } = await setup(fk);
    await deleteAccount(db, ids[0]);
    const text = makeExport('#AAA111');
    await expect(importExport(db, parseExport(text), text, { alias: 'De nuevo', now: T0 + 5 })).resolves.toMatchObject({
      isNew: true,
    });
  });
});
