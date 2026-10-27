import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { upgradeName } from '@/domain/names';

import { CATALOG_SOURCE, catalogLevels, catalogName, catalogNameEn, pickableItems } from '..';
import data from '../catalog.json';
import { NAMES_ES } from '../names.es';

describe('catálogo de nombres', () => {
  it('resuelve IDs conocidos de cada tipo de elemento (inglés)', () => {
    expect(catalogNameEn(1000001)).toBe('Town Hall');
    expect(catalogNameEn(1000007)).toBe('Laboratory');
    expect(catalogNameEn(1000015)).toBe("Builder's Hut");
    expect(catalogNameEn(1000027)).toBe('Inferno Tower');
    expect(catalogNameEn(28000002)).toBe('Grand Warden');
    expect(catalogNameEn(28000007)).toBe('Dragon Duke');
  });

  it('devuelve null para un ID que no conoce', () => {
    expect(catalogName(999)).toBeNull();
    expect(catalogNameEn(-1)).toBeNull();
    expect(catalogLevels(999)).toEqual([]);
  });

  it('todas las entradas son [nombre, categoría, base, niveles] con nombre no vacío', () => {
    const entries = Object.entries(data.items) as [string, unknown[]][];
    expect(entries.length).toBeGreaterThan(200);
    for (const [id, entry] of entries) {
      expect(id).toMatch(/^\d+$/);
      expect(entry).toHaveLength(4);
      expect(String(entry[0]).trim()).not.toBe('');
      expect(Array.isArray(entry[3])).toBe(true);
    }
  });

  it('indica su fuente y licencia', () => {
    expect(CATALOG_SOURCE).toMatch(/clash-of-clans-data@.+\(MIT\)/);
  });
});

describe('nombres en español', () => {
  it('se usan cuando existen y el inglés es el respaldo', () => {
    expect(catalogName(1000001)).toBe('Ayuntamiento');
    expect(catalogName(1000027)).toBe('Torre infernal');
    expect(catalogName(28000002)).toBe('Gran Centinela');
    expect(catalogName(28000007)).toBe('Dragon Duke'); // sin traducción conocida
  });

  it('cada ID traducido existe en el catálogo y ningún nombre queda vacío', () => {
    for (const [id, name] of Object.entries(NAMES_ES)) {
      expect(catalogNameEn(Number(id))).not.toBeNull();
      expect(name.trim()).not.toBe('');
    }
  });
});

describe('costos por nivel', () => {
  it('la Torre infernal nivel 1 cuesta 1 000 000 de oro y 12 h', () => {
    const levels = catalogLevels(1000027);
    expect(levels.length).toBeGreaterThanOrEqual(12);
    expect(levels[0]).toEqual({ cost: 1_000_000, resource: 'gold', seconds: 12 * 3600 });
  });

  it('descarta el tramo repetido de otra variante: el Mortero tiene niveles crecientes', () => {
    const costs = catalogLevels(1000013).map((l) => l.cost);
    expect(costs.length).toBeGreaterThan(10);
    expect(costs.every((c, i) => i === 0 || c >= costs[i - 1])).toBe(true);
  });

  it('el equipo de héroe no tiene costos', () => {
    expect(catalogLevels(90000000)).toEqual([]);
  });

  it('los tiempos y costos son enteros no negativos', () => {
    for (const id of Object.keys(data.items)) {
      for (const level of catalogLevels(Number(id))) {
        expect(Number.isInteger(level.cost) && level.cost >= 0).toBe(true);
        expect(Number.isInteger(level.seconds) && level.seconds >= 0).toBe(true);
      }
    }
  });
});

describe('pickableItems', () => {
  const list = pickableItems();

  it('solo trae elementos de la aldea principal con costos en oro, elixir u oscuro', () => {
    expect(list.length).toBeGreaterThan(50);
    for (const item of list) {
      expect(item.maxLevel).toBeGreaterThan(0);
      for (const level of catalogLevels(item.id)) expect(['gold', 'elixir', 'dark', 'gold_or_elixir']).toContain(level.resource);
    }
  });

  it('incluye la Torre infernal y no el equipo de héroe ni la base del constructor', () => {
    expect(list.map((i) => i.id)).toContain(1000027);
    expect(list.map((i) => i.id)).not.toContain(90000000);
    expect(list.map((i) => i.id)).not.toContain(1000035);
  });

  it('está ordenada por nombre', () => {
    const names = list.map((i) => i.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' })));
  });
});

describe('upgradeName', () => {
  it('usa el nombre guardado, luego el del catálogo, luego el ID', () => {
    expect(upgradeName(1000027, 'Mi nombre')).toBe('Mi nombre');
    expect(upgradeName(1000027, null)).toBe('Torre infernal');
    expect(upgradeName(999, null)).toBe('Mejora (ID 999)');
  });
});

// samples/ está en .gitignore (datos personales). Sin la carpeta, la prueba se salta.
const SAMPLES = join(__dirname, '..', '..', '..', 'samples');
const files = ['cuenta-a.json', 'cuenta-b.json', 'cuenta-c.json'];
const runSamples = files.every((f) => existsSync(join(SAMPLES, f))) ? it : it.skip;

runSamples('todos los elementos con nivel de los exports reales tienen nombre', () => {
  const missing = new Set<string>();
  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(SAMPLES, f), 'utf8'));
    for (const list of ['buildings', 'traps', 'units', 'siege_machines', 'heroes', 'spells', 'pets', 'equipment', 'buildings2', 'traps2', 'units2', 'heroes2']) {
      for (const e of raw[list] ?? []) if (catalogName(e.data) === null) missing.add(`${list}:${e.data}`);
    }
  }
  expect([...missing]).toEqual([]);
});
