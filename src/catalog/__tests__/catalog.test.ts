import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { upgradeName } from '@/domain/names';

import { CATALOG_SOURCE, catalogName } from '..';
import data from '../catalog.json';

describe('catálogo de nombres', () => {
  it('resuelve IDs conocidos de cada tipo de elemento', () => {
    expect(catalogName(1000001)).toBe('Town Hall');
    expect(catalogName(1000007)).toBe('Laboratory');
    expect(catalogName(1000010)).toBe('Wall');
    expect(catalogName(1000015)).toBe("Builder's Hut");
    expect(catalogName(1000027)).toBe('Inferno Tower');
    expect(catalogName(28000002)).toBe('Grand Warden');
    expect(catalogName(28000007)).toBe('Dragon Duke');
  });

  it('devuelve null para un ID que no conoce', () => {
    expect(catalogName(999)).toBeNull();
    expect(catalogName(-1)).toBeNull();
  });

  it('todas las entradas son [nombre, categoría, base] con nombre no vacío', () => {
    const entries = Object.entries(data.items) as [string, string[]][];
    expect(entries.length).toBeGreaterThan(200);
    for (const [id, entry] of entries) {
      expect(id).toMatch(/^\d+$/);
      expect(entry).toHaveLength(3);
      expect(entry[0].trim()).not.toBe('');
    }
  });

  it('indica su fuente y licencia', () => {
    expect(CATALOG_SOURCE).toMatch(/clash-of-clans-data@.+\(MIT\)/);
  });
});

describe('upgradeName', () => {
  it('usa el nombre guardado, luego el del catálogo, luego el ID', () => {
    expect(upgradeName(1000027, 'Mi nombre')).toBe('Mi nombre');
    expect(upgradeName(1000027, null)).toBe('Inferno Tower');
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
