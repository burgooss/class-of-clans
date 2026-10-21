import { ExportParseError, parseExport } from '..';

const NOW = 1_800_000_000;

function minimalExport(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    tag: '#ABC123',
    timestamp: 1_700_000_000,
    buildings: [
      { data: 1000001, lvl: 9, cnt: 1 },
      { data: 1000015, lvl: 1, cnt: 3 },
    ],
    heroes: [],
    units: [],
    ...overrides,
  });
}

function errorCode(text: string): string | undefined {
  try {
    parseExport(text, { now: NOW });
  } catch (e) {
    if (e instanceof ExportParseError) return e.code;
    throw e;
  }
  return undefined;
}

describe('parseExport (casos sintéticos)', () => {
  it('lee tag, hora, ayuntamiento y constructores', () => {
    const result = parseExport(minimalExport(), { now: NOW });
    expect(result).toEqual({
      tag: '#ABC123',
      capturedAt: 1_700_000_000,
      townHall: 9,
      builderCount: 3,
      upgrades: [],
    });
  });

  it('calcula endsAt como timestamp + timer y clasifica por arreglo', () => {
    const result = parseExport(
      minimalExport({
        buildings: [
          { data: 1000001, lvl: 9, cnt: 1 },
          { data: 1000015, lvl: 1, cnt: 1 },
          { data: 1000003, lvl: 6, timer: 600 },
        ],
        heroes: [{ data: 28000000, lvl: 10, timer: 60 }],
        units: [{ data: 4000000, lvl: 2, timer: 30 }],
        pets: [{ data: 73000000, lvl: 3, timer: 15 }],
        spells: [{ data: 26000000, lvl: 3, timer: 5 }],
        buildings2: [{ data: 1000033, lvl: 2, timer: 7 }],
      }),
      { now: NOW },
    );
    const by = (source: string) => result.upgrades.find((u) => u.source === source);

    expect(result.upgrades).toHaveLength(6);
    expect(by('buildings')).toMatchObject({ slotType: 'builder', gameId: 1000003, level: 6, endsAt: 1_700_000_600 });
    expect(by('heroes')).toMatchObject({ slotType: 'builder', endsAt: 1_700_000_060 });
    expect(by('units')).toMatchObject({ slotType: 'lab', remainingSeconds: 30 });
    expect(by('pets')?.slotType).toBe('pet_house');
    expect(by('spells')?.slotType).toBe('other');
    expect(by('buildings2')?.slotType).toBe('builder_base');
  });

  it('cuenta las cabañas individuales y las agrupadas', () => {
    const result = parseExport(
      minimalExport({
        buildings: [
          { data: 1000015, lvl: 3, timer: 100 },
          { data: 1000015, lvl: 3, timer: 200 },
          { data: 1000015, lvl: 4, cnt: 2 },
        ],
      }),
      { now: NOW },
    );
    expect(result.builderCount).toBe(4);
    expect(result.upgrades).toHaveLength(2);
  });

  it('devuelve null si no hay ayuntamiento ni cabañas', () => {
    const result = parseExport(minimalExport({ buildings: [] }), { now: NOW });
    expect(result.townHall).toBeNull();
    expect(result.builderCount).toBeNull();
  });

  it('usa la hora de import si el export no trae timestamp', () => {
    const text = JSON.stringify({ tag: '#ABC123', buildings: [{ data: 1000003, lvl: 1, timer: 10 }] });
    const result = parseExport(text, { now: NOW });
    expect(result.capturedAt).toBe(NOW);
    expect(result.upgrades[0].endsAt).toBe(NOW + 10);
  });

  it('normaliza el tag a mayúsculas y tolera espacios y BOM', () => {
    const result = parseExport(`﻿  ${minimalExport({ tag: '#abc123' })}\n`, { now: NOW });
    expect(result.tag).toBe('#ABC123');
  });

  it('ignora listas de números sueltos (cosméticos)', () => {
    const result = parseExport(minimalExport({ house_parts: [82000000, 82000001], skins: [52000020] }), { now: NOW });
    expect(result.upgrades).toEqual([]);
  });
});

describe('parseExport (errores)', () => {
  it.each([
    ['texto vacío', '', 'empty'],
    ['solo espacios', '   \n', 'empty'],
    ['texto que no es JSON', 'hola mundo', 'invalid_json'],
    ['JSON cortado', '{"tag":"#ABC123","build', 'invalid_json'],
    ['un arreglo', '[1,2,3]', 'not_an_export'],
    ['un número', '42', 'not_an_export'],
    ['objeto sin tag', JSON.stringify({ buildings: [] }), 'not_an_export'],
    ['tag inválido', JSON.stringify({ tag: 'ABC', buildings: [] }), 'not_an_export'],
    ['sin buildings', JSON.stringify({ tag: '#ABC123' }), 'not_an_export'],
    ['timestamp inválido', minimalExport({ timestamp: 'ayer' }), 'malformed'],
    ['timer negativo', minimalExport({ heroes: [{ data: 28000000, lvl: 1, timer: -5 }] }), 'malformed'],
    ['timer no numérico', minimalExport({ heroes: [{ data: 28000000, lvl: 1, timer: '60' }] }), 'malformed'],
  ])('rechaza %s', (_name, text, code) => {
    expect(errorCode(text)).toBe(code);
  });

  it('el error trae un mensaje en español', () => {
    expect(() => parseExport('hola')).toThrow('El portapapeles no contiene un JSON válido.');
  });
});
