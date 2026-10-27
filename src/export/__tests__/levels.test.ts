import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { currentLevels } from '../levels';

const text = (o: unknown) => JSON.stringify(o);

describe('currentLevels', () => {
  it('lee el nivel de cada elemento de las listas de la aldea principal', () => {
    const levels = currentLevels(
      text({
        buildings: [{ data: 1000001, lvl: 9, cnt: 1 }],
        heroes: [{ data: 28000000, lvl: 40 }],
        units: [{ data: 4000000, lvl: 5 }],
        spells: [{ data: 26000000, lvl: 3 }],
        pets: [{ data: 73000000, lvl: 2 }],
        siege_machines: [{ data: 4000051, lvl: 1 }],
        traps: [{ data: 12000000, lvl: 4, cnt: 3 }],
      }),
    );
    expect(Object.fromEntries(levels)).toEqual({
      1000001: 9,
      28000000: 40,
      4000000: 5,
      26000000: 3,
      73000000: 2,
      4000051: 1,
      12000000: 4,
    });
  });

  it('si hay varios del mismo elemento usa el de menor nivel', () => {
    const levels = currentLevels(
      text({ buildings: [{ data: 1000008, lvl: 19, cnt: 6 }, { data: 1000008, lvl: 15, cnt: 1 }, { data: 1000008, lvl: 17, timer: 5 }] }),
    );
    expect(levels.get(1000008)).toBe(15);
  });

  it('ignora la base del constructor, el equipo y las entradas sin nivel', () => {
    const levels = currentLevels(
      text({
        buildings2: [{ data: 1000034, lvl: 3 }],
        equipment: [{ data: 90000000, lvl: 7 }],
        buildings: [{ data: 1000010, cnt: 5 }, { data: 'x', lvl: 1 }, 7, null],
        house_parts: [82000000],
      }),
    );
    expect(levels.size).toBe(0);
  });

  it.each(['', 'no es json', '[1,2]', 'null', '42', '{"buildings": 5}'])('un texto que no sirve (%j) da un mapa vacío', (raw) => {
    expect(currentLevels(raw).size).toBe(0);
  });
});

// samples/ está en .gitignore (datos personales). Sin la carpeta, la prueba se salta.
const sample = join(__dirname, '..', '..', '..', 'samples', 'cuenta-a.json');
const runSample = existsSync(sample) ? it : it.skip;

runSample('lee los niveles de un export real: ayuntamiento 14 y Torre infernal con varios niveles', () => {
  const levels = currentLevels(readFileSync(sample, 'utf8'));
  expect(levels.get(1000001)).toBe(14); // ayuntamiento
  expect(levels.get(1000027)).toBe(7); // Torre infernal: 3 torres de nivel 7
  expect(levels.size).toBeGreaterThan(50);
});
