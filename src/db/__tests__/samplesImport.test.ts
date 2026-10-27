import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { buildOverview, type OverviewUpgrade } from '@/domain/overview';
import { parseExport } from '@/export';

import { importExport } from '../imports';
import { migrateDb } from '../migrations';
import { getAccounts, getAllUpgrades } from '../queries';
import { createTestDb } from '../testing/nodeSqlite';

// samples/ está en .gitignore (datos personales). Sin la carpeta, la prueba se salta.
const DIR = join(__dirname, '..', '..', '..', 'samples');
const FILES = ['cuenta-a.json', 'cuenta-b.json', 'cuenta-c.json'];
const run = FILES.every((f) => existsSync(join(DIR, f))) ? it : it.skip;

run('importa las 3 cuentas reales y arma la vista general', async () => {
  const db = createTestDb();
  await migrateDb(db);

  const texts = FILES.map((f) => readFileSync(join(DIR, f), 'utf8'));
  const stamps = texts.map((t) => JSON.parse(t).timestamp as number);
  const start = Math.max(...stamps);

  for (const [i, text] of texts.entries()) {
    const result = await importExport(db, parseExport(text), text, { alias: `Cuenta ${i + 1}`, now: start });
    expect(result.isNew).toBe(true);
  }

  const accounts = await getAccounts(db);
  expect(accounts.map((a) => [a.town_hall, a.builder_count])).toEqual([
    [14, 5],
    [8, 3],
    [4, 2],
  ]);

  const upgrades = await getAllUpgrades(db);
  const byAccount = new Map<number, OverviewUpgrade[]>();
  for (const u of upgrades) {
    byAccount.set(u.account_id, [...(byAccount.get(u.account_id) ?? []), { gameId: u.game_id, endsAt: u.ends_at, slot: u.slot_type }]);
  }
  const overview = (now: number) =>
    buildOverview(
      accounts.map((a) => ({ id: a.id, alias: a.alias, tag: a.tag, builderCount: a.builder_count })),
      byAccount,
      now,
    );

  // Al momento del último export, todos los constructores aparecen ocupados.
  const atExport = overview(start);
  expect(atExport.map((r) => r.freeNow)).toEqual([0, 0, 0]);
  // La cuenta pequeña termina primero (unas 2 h); la grande, después de ~21 h.
  expect(atExport.map((r) => r.alias)).toEqual(['Cuenta 3', 'Cuenta 2', 'Cuenta 1']);

  // Pasadas 2 h, la cuenta 3 ya tiene sus 2 constructores libres y sube al primer lugar.
  const later = overview(start + 2 * 3600);
  expect(later[0]).toMatchObject({ alias: 'Cuenta 3', freeNow: 2 });
});
