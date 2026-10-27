import { type Backup, BACKUP_FORMAT, BACKUP_VERSION, BackupError, parseBackup, summarize } from '../format';

const SCHEMA = 1;
const NO_RESOURCES = { gold: null, elixir: null, dark_elixir: null, resources_updated_at: null };

function sample(): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    schemaVersion: SCHEMA,
    exportedAt: 1_700_000_000,
    tables: {
      accounts: [
        { id: 1, tag: '#AAA111', alias: 'Principal', town_hall: 9, builder_count: 3, notifications_on: 1, last_export_id: 10, created_at: 1, ...NO_RESOURCES },
        { id: 2, tag: '#BBB222', alias: 'Granja', town_hall: null, builder_count: null, notifications_on: 0, last_export_id: null, created_at: 2, ...NO_RESOURCES },
      ],
      exports: [{ id: 10, account_id: 1, captured_at: 5, imported_at: 6, raw_json: '{"tag":"#AAA111"}' }],
      active_upgrades: [
        { id: 1, account_id: 1, export_id: 10, slot_type: 'builder', game_id: 1000003, name: null, target_level: 6, ends_at: 99 },
      ],
      suggestions: [
        { id: 1, account_id: 2, description: 'Torre', target_level: null, position: 1, status: 'pending', notes: null, created_at: 3, game_id: null },
      ],
      layouts: [
        { id: 1, account_id: null, name: 'Base', url: 'https://x.com/a', town_hall: 9, kind: 'war', notes: null, created_at: 4 },
      ],
      armies: [
        { id: 1, account_id: 1, name: 'Ejército', url: 'https://x.com/b', town_hall: null, purpose: 'farm', notes: 'n', created_at: 4 },
      ],
    },
  };
}

const text = (b: unknown) => JSON.stringify(b);
const parse = (b: unknown) => parseBackup(text(b), { schemaVersion: SCHEMA });

/** Aplica un cambio sobre una copia del respaldo de ejemplo. */
function mutate(change: (b: Backup) => void): Backup {
  const b = sample();
  change(b);
  return b;
}

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof BackupError) return e.code;
    throw e;
  }
  return undefined;
};

describe('parseBackup: respaldo válido', () => {
  it('acepta el respaldo de ejemplo tal cual', () => {
    expect(parse(sample())).toEqual(sample());
  });

  it('descarta columnas desconocidas y tolera BOM y espacios', () => {
    const b = sample();
    (b.tables.accounts[0] as Record<string, unknown>).notification_id = 'x';
    (b as unknown as Record<string, unknown>).extra = 1;
    const result = parseBackup(`﻿  ${text(b)}\n`, { schemaVersion: SCHEMA });
    expect(result.tables.accounts[0]).not.toHaveProperty('notification_id');
    expect(result).not.toHaveProperty('extra');
  });

  it('acepta una base de datos vacía', () => {
    const empty = mutate((b) => {
      for (const k of Object.keys(b.tables)) (b.tables as Record<string, unknown[]>)[k] = [];
    });
    expect(summarize(parse(empty))).toEqual({ accounts: 0, exports: 0, active_upgrades: 0, suggestions: 0, layouts: 0, armies: 0 });
  });

  it('resume la cantidad de filas', () => {
    expect(summarize(parse(sample()))).toEqual({ accounts: 2, exports: 1, active_upgrades: 1, suggestions: 1, layouts: 1, armies: 1 });
  });
});

describe('parseBackup: archivo que no es un respaldo', () => {
  it.each([
    ['texto', 'hola'],
    ['JSON cortado', '{"format":'],
  ])('%s → invalid_json', (_n, t) => {
    expect(codeOf(() => parseBackup(t, { schemaVersion: SCHEMA }))).toBe('invalid_json');
  });

  it.each([
    ['un arreglo', []],
    ['un número', 3],
    ['otro formato', { format: 'otro' }],
    ['un export del juego', { tag: '#ABC123', buildings: [] }],
  ])('%s → not_a_backup', (_n, value) => {
    expect(codeOf(() => parse(value))).toBe('not_a_backup');
  });
});

describe('parseBackup: versiones', () => {
  it('rechaza un respaldo de una versión de formato más nueva', () => {
    expect(codeOf(() => parse(mutate((b) => void (b.version = BACKUP_VERSION + 1))))).toBe('unsupported_version');
  });

  it('rechaza un esquema más nuevo que el de la app o inválido', () => {
    expect(codeOf(() => parse(mutate((b) => void (b.schemaVersion = SCHEMA + 1))))).toBe('unsupported_version');
    expect(codeOf(() => parse(mutate((b) => void (b.schemaVersion = 0))))).toBe('unsupported_version');
  });

  it('convierte un respaldo del esquema 1 al 2 sumando 1 a target_level de las mejoras', () => {
    const old = sample(); // target_level = 6, esquema 1
    old.tables.active_upgrades.push({ ...old.tables.active_upgrades[0], id: 2, target_level: null });
    const result = parseBackup(text(old), { schemaVersion: 2 });
    expect(result.schemaVersion).toBe(2);
    expect(result.tables.active_upgrades.map((u) => u.target_level)).toEqual([7, null]);
    // Las sugerencias tienen su propio target_level y no se tocan.
    expect(result.tables.suggestions).toEqual(old.tables.suggestions);
  });

  it('un respaldo del esquema 1 llega hasta el 3: las columnas nuevas quedan en null', () => {
    const result = parseBackup(text(sample()), { schemaVersion: 3 });
    expect(result.schemaVersion).toBe(3);
    expect(result.tables.accounts[0]).toMatchObject({ gold: null, elixir: null, dark_elixir: null, resources_updated_at: null });
    expect(result.tables.suggestions[0].game_id).toBeNull();
    expect(result.tables.active_upgrades[0].target_level).toBe(7); // la conversión 1→2 también se aplicó
  });

  it('un respaldo del esquema 2 no pierde ni cambia datos al pasar al 3', () => {
    const v2 = mutate((b) => void (b.schemaVersion = 2));
    const result = parseBackup(text(v2), { schemaVersion: 3 });
    expect(result.tables.active_upgrades[0].target_level).toBe(6);
  });

  it('un respaldo del esquema 3 conserva recursos y game_id', () => {
    const v3 = mutate((b) => {
      b.schemaVersion = 3;
      Object.assign(b.tables.accounts[0], { gold: 100, elixir: 200, dark_elixir: 3, resources_updated_at: 55 });
      b.tables.suggestions[0].game_id = 1000027;
    });
    const result = parseBackup(text(v3), { schemaVersion: 3 });
    expect(result.tables.accounts[0]).toMatchObject({ gold: 100, elixir: 200, dark_elixir: 3, resources_updated_at: 55 });
    expect(result.tables.suggestions[0].game_id).toBe(1000027);
  });

  it('un respaldo ya en el esquema actual no se convierte', () => {
    const current = mutate((b) => void (b.schemaVersion = 2));
    expect(parseBackup(text(current), { schemaVersion: 2 }).tables.active_upgrades[0].target_level).toBe(6);
  });
});

describe('parseBackup: datos dañados', () => {
  const cases: [string, (b: Backup) => void][] = [
    ['version no entera', (b) => void ((b as unknown as Record<string, unknown>).version = '1')],
    ['exportedAt ausente', (b) => void delete (b as unknown as Record<string, unknown>).exportedAt],
    ['tabla ausente', (b) => void delete (b.tables as Record<string, unknown>).armies],
    ['tabla que no es lista', (b) => void ((b.tables as Record<string, unknown>).layouts = {})],
    ['fila que no es objeto', (b) => void (b.tables.suggestions[0] = 5 as never)],
    ['columna obligatoria ausente', (b) => void delete b.tables.accounts[0].alias],
    ['alias vacío', (b) => void (b.tables.accounts[0].alias = '  ')],
    ['entero con decimales', (b) => void (b.tables.accounts[0].town_hall = 9.5)],
    ['texto donde va un entero', (b) => void (b.tables.accounts[0].builder_count = '3')],
    ['entero donde va texto', (b) => void (b.tables.layouts[0].name = 7)],
    ['estado no permitido', (b) => void (b.tables.suggestions[0].status = 'borrada')],
    ['tipo de base no permitido', (b) => void (b.tables.layouts[0].kind = 'oops')],
    ['uso de ejército no permitido', (b) => void (b.tables.armies[0].purpose = 'trophy')],
    ['notifications_on fuera de 0/1', (b) => void (b.tables.accounts[0].notifications_on = 2)],
    ['id no positivo', (b) => void (b.tables.accounts[0].id = 0)],
    ['url vacía', (b) => void (b.tables.layouts[0].url = '')],
  ];
  it.each(cases)('%s → malformed', (_n, change) => {
    expect(codeOf(() => parse(mutate(change)))).toBe('malformed');
  });
});

describe('parseBackup: referencias inconsistentes', () => {
  const cases: [string, (b: Backup) => void][] = [
    ['ids repetidos', (b) => void (b.tables.accounts[1].id = 1)],
    ['tags repetidos', (b) => void (b.tables.accounts[1].tag = '#AAA111')],
    ['export de cuenta inexistente', (b) => void (b.tables.exports[0].account_id = 99)],
    ['last_export_id inexistente', (b) => void (b.tables.accounts[0].last_export_id = 99)],
    ['last_export_id de otra cuenta', (b) => void (b.tables.accounts[1].last_export_id = 10)],
    ['mejora de cuenta inexistente', (b) => void (b.tables.active_upgrades[0].account_id = 99)],
    ['mejora con export inexistente', (b) => void (b.tables.active_upgrades[0].export_id = 99)],
    ['mejora con export de otra cuenta', (b) => void (b.tables.active_upgrades[0].account_id = 2)],
    ['sugerencia de cuenta inexistente', (b) => void (b.tables.suggestions[0].account_id = 99)],
    ['base de cuenta inexistente', (b) => void (b.tables.layouts[0].account_id = 99)],
    ['ejército de cuenta inexistente', (b) => void (b.tables.armies[0].account_id = 99)],
  ];
  it.each(cases)('%s → inconsistent', (_n, change) => {
    expect(codeOf(() => parse(mutate(change)))).toBe('inconsistent');
  });
});
