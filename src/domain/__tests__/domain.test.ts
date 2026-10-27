import { BUILDER_HUT_ID } from '@/export/ids';

import { freeBuilderCount, nextFreeAt, runningUpgrades } from '../builders';
import { formatAgo, formatRemaining } from '../format';
import { buildOverview } from '../overview';

const NOW = 1_000_000;
const up = (endsAt: number, gameId = 1000003, slot = 'builder') => ({ gameId, endsAt, slot });

describe('constructores libres', () => {
  it('resta las mejoras en curso del total', () => {
    expect(freeBuilderCount(5, [up(NOW + 10), up(NOW + 20)], NOW)).toBe(3);
  });

  it('una mejora ya terminada no ocupa constructor', () => {
    expect(freeBuilderCount(2, [up(NOW - 1), up(NOW), up(NOW + 1)], NOW)).toBe(1);
  });

  it('nunca baja de cero', () => {
    expect(freeBuilderCount(1, [up(NOW + 1), up(NOW + 2)], NOW)).toBe(0);
  });

  it('devuelve null si no se conoce el total', () => {
    expect(freeBuilderCount(null, [up(NOW + 1)], NOW)).toBeNull();
  });

  it('las cabañas en mejora ocupan constructor (suposición provisional)', () => {
    const hut = up(NOW + 100, BUILDER_HUT_ID);
    expect(runningUpgrades([hut], NOW)).toHaveLength(1);
    expect(freeBuilderCount(3, [hut], NOW)).toBe(2);
  });
});

describe('nextFreeAt', () => {
  it('es la menor hora de fin futura', () => {
    expect(nextFreeAt([up(NOW + 50), up(NOW + 10), up(NOW - 5)], NOW)).toBe(NOW + 10);
  });

  it('es null si no hay mejoras en curso', () => {
    expect(nextFreeAt([], NOW)).toBeNull();
    expect(nextFreeAt([up(NOW - 5)], NOW)).toBeNull();
  });
});

describe('buildOverview', () => {
  const accounts = [
    { id: 1, alias: 'Principal', tag: '#A', builderCount: 2 },
    { id: 2, alias: 'Granja', tag: '#B', builderCount: 2 },
    { id: 3, alias: 'Libre', tag: '#C', builderCount: 2 },
    { id: 4, alias: 'Sin datos', tag: '#D', builderCount: null },
  ];
  const upgrades = new Map([
    [1, [up(NOW + 500), up(NOW + 900)]],
    [2, [up(NOW + 100), up(NOW + 700)]],
    [3, [up(NOW + 300)]],
  ]);

  it('pone primero las cuentas con constructores libres y luego por la próxima liberación', () => {
    const rows = buildOverview(accounts, upgrades, NOW);
    expect(rows.map((r) => r.alias)).toEqual(['Libre', 'Granja', 'Principal', 'Sin datos']);
  });

  it('calcula libres y siguiente por cuenta', () => {
    const rows = buildOverview(accounts, upgrades, NOW);
    expect(rows[0]).toMatchObject({ accountId: 3, freeNow: 1, nextFreeAt: NOW + 300 });
    expect(rows[1]).toMatchObject({ accountId: 2, freeNow: 0, nextFreeAt: NOW + 100 });
    expect(rows[3]).toMatchObject({ accountId: 4, freeNow: null, nextFreeAt: null });
  });

  it('una mejora que termina cambia el orden sin reimportar', () => {
    const rows = buildOverview(accounts, upgrades, NOW + 600);
    // A las +600: Granja tiene 1 libre (la de +100 terminó), Principal tiene 1 libre (+500).
    expect(rows.map((r) => r.alias)).toEqual(['Granja', 'Libre', 'Principal', 'Sin datos']);
  });
});

describe('buildOverview: laboratorio y casa de mascotas', () => {
  const account = [{ id: 1, alias: 'Una', tag: '#A', builderCount: 2 }];
  const row = (upgrades: ReturnType<typeof up>[], now = NOW) =>
    buildOverview(account, new Map([[1, upgrades]]), now)[0];

  it('muestra el próximo fin de cada espacio extra que tiene algo en curso', () => {
    const r = row([up(NOW + 900, 4000000, 'lab'), up(NOW + 300, 4000001, 'lab'), up(NOW + 5000, 73000000, 'pet_house')]);
    expect(r.extras).toEqual([
      { slot: 'lab', endsAt: NOW + 300 },
      { slot: 'pet_house', endsAt: NOW + 5000 },
    ]);
  });

  it('no incluye espacios sin nada en curso', () => {
    expect(row([up(NOW + 100)]).extras).toEqual([]);
    expect(row([up(NOW - 5, 4000000, 'lab')]).extras).toEqual([]);
  });

  it('lo del laboratorio y las mascotas no ocupa constructores ni cambia el siguiente libre', () => {
    const r = row([up(NOW + 100, 1000003, 'builder'), up(NOW + 10, 4000000, 'lab'), up(NOW + 20, 73000000, 'pet_house')]);
    expect(r.freeNow).toBe(1);
    expect(r.nextFreeAt).toBe(NOW + 100);
  });
});

describe('formato de tiempo', () => {
  it.each([
    [0, '0m 0s'],
    [59, '0m 59s'],
    [125, '2m 5s'],
    [3600, '1h 0m 0s'],
    [3 * 3600 + 4 * 60 + 5, '3h 4m 5s'],
    [86400, '1d 0h 0m'],
    [2 * 86400 + 3 * 3600 + 4 * 60 + 59, '2d 3h 4m'],
    [-10, '0m 0s'],
  ])('formatRemaining(%i) = %s', (seconds, expected) => {
    expect(formatRemaining(seconds)).toBe(expected);
  });

  it.each([
    [5, 'hace unos segundos'],
    [60, 'hace 1 min'],
    [3599, 'hace 59 min'],
    [3600, 'hace 1 h'],
    [86399, 'hace 23 h'],
    [86400, 'hace 1 d'],
    [3 * 86400, 'hace 3 d'],
  ])('formatAgo(%i) = %s', (seconds, expected) => {
    expect(formatAgo(seconds)).toBe(expected);
  });
});
