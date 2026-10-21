import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { parseExport } from '..';

// samples/ está en .gitignore (datos personales). Sin la carpeta, estas pruebas se saltan.
const SAMPLES_DIR = join(__dirname, '..', '..', '..', 'samples');

// Cantidades esperadas, obtenidas del análisis de docs/formato-export.md.
// townHall y builderCount siguen pendientes de confirmar con el usuario.
const EXPECTED = [
  { file: 'cuenta-a.json', townHall: 14, builderCount: 5, slots: { builder: 5, lab: 1, pet_house: 1 } },
  { file: 'cuenta-b.json', townHall: 8, builderCount: 3, slots: { builder: 3, lab: 1 } },
  { file: 'cuenta-c.json', townHall: 4, builderCount: 2, slots: { builder: 2 } },
];

describe.each(EXPECTED)('samples/$file', ({ file, townHall, builderCount, slots }) => {
  const path = join(SAMPLES_DIR, file);
  const run = existsSync(path) ? it : it.skip;

  run('se parsea y coincide con el análisis', () => {
    const text = readFileSync(path, 'utf8');
    const raw = JSON.parse(text);
    const result = parseExport(text);

    expect(result.tag).toBe(raw.tag);
    expect(result.capturedAt).toBe(raw.timestamp);
    expect(result.townHall).toBe(townHall);
    expect(result.builderCount).toBe(builderCount);

    const counts: Record<string, number> = {};
    for (const u of result.upgrades) counts[u.slotType] = (counts[u.slotType] ?? 0) + 1;
    expect(counts).toEqual(slots);
  });

  run('cada mejora termina en timestamp + timer', () => {
    const text = readFileSync(path, 'utf8');
    const raw = JSON.parse(text);
    const result = parseExport(text);
    for (const u of result.upgrades) {
      expect(u.endsAt).toBe(raw.timestamp + u.remainingSeconds);
      expect(u.endsAt).toBeGreaterThan(raw.timestamp);
    }
  });
});
