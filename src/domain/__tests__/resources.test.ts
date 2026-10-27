import type { CatalogLevel } from '@/catalog';

import {
  checkAffordable,
  costToReach,
  describeCost,
  describeMissing,
  evaluateSuggestion,
  formatAmount,
  MAX_AMOUNT,
  parseAmount,
  suggestionCost,
  type Cost,
  type Resources,
} from '../resources';

const lv = (cost: number, resource: CatalogLevel['resource'], seconds = 60): CatalogLevel => ({ cost, resource, seconds });
const cost = (partial: Partial<Cost>): Cost => ({ gold: 0, elixir: 0, dark: 0, goldOrElixir: 0, seconds: 0, ...partial });
const res = (gold: number | null, elixir: number | null, dark: number | null): Resources => ({ gold, elixir, dark });

describe('parseAmount', () => {
  it.each([
    ['', null],
    ['   ', null],
    ['0', 0],
    ['1500000', 1_500_000],
    ['1,234,567', 1_234_567],
    ['1.234.567', 1_234_567],
    ['1 234 567', 1_234_567],
    ['85,300', 85_300],
    ['850k', 850_000],
    ['850K', 850_000],
    ['1.5M', 1_500_000],
    ['1,5m', 1_500_000],
    ['2m', 2_000_000],
    ['0.5b', 500_000_000],
    ['12 k', 12_000],
  ])('acepta %j', (text, value) => {
    expect(parseAmount(text)).toEqual({ ok: true, value });
  });

  it.each(['abc', '-5', '1.5', '12,5', '1,23', '1..2', '1m2', 'k', '1.2.3', '10000000000', '99999999999'])('rechaza %j', (text) => {
    expect(parseAmount(text)).toEqual({ ok: false });
  });

  it('acepta el máximo y rechaza uno más', () => {
    expect(parseAmount(String(MAX_AMOUNT))).toEqual({ ok: true, value: MAX_AMOUNT });
    expect(parseAmount(String(MAX_AMOUNT + 1))).toEqual({ ok: false });
  });
});

describe('formatAmount', () => {
  it.each([
    [0, '0'],
    [950, '950'],
    [85_300, '85,300'],
    [999_999, '999,999'],
    [1_000_000, '1M'],
    [4_250_000, '4.25M'],
    [4_251_234, '4.25M'],
    [12_000_000, '12M'],
    [1_500_000_000, '1500M'],
  ])('formatAmount(%i) = %s', (n, text) => {
    expect(formatAmount(n)).toBe(text);
  });
});

describe('costToReach', () => {
  const levels = [lv(100, 'gold', 10), lv(200, 'gold', 20), lv(300, 'gold', 30), lv(400, 'elixir', 40)];

  it('suma los niveles desde el siguiente al actual hasta el objetivo', () => {
    expect(costToReach(levels, 1, 3)).toEqual({ ...cost({ gold: 500, seconds: 50 }), steps: 2 });
    expect(costToReach(levels, 2, 4)).toEqual({ ...cost({ gold: 300, elixir: 400, seconds: 70 }), steps: 2 });
  });

  it('sin nivel actual solo cuenta el nivel objetivo', () => {
    expect(costToReach(levels, null, 3)).toEqual({ ...cost({ gold: 300, seconds: 30 }), steps: 1 });
  });

  it('un elemento que ya está en el objetivo o más no cuesta nada', () => {
    expect(costToReach(levels, 3, 3)).toEqual({ ...cost({}), steps: 0 });
    expect(costToReach(levels, 4, 2)).toEqual({ ...cost({}), steps: 0 });
  });

  it('devuelve null si el nivel no existe o no hay costos', () => {
    expect(costToReach(levels, 1, 5)).toBeNull();
    expect(costToReach(levels, 1, 0)).toBeNull();
    expect(costToReach([], 1, 2)).toBeNull();
  });

  it('agrupa por tipo de recurso, incluido "oro o elixir", y rechaza recursos de la base del constructor', () => {
    expect(costToReach([lv(10, 'dark'), lv(20, 'gold_or_elixir')], 0, 2)).toEqual({ ...cost({ dark: 10, goldOrElixir: 20, seconds: 120 }), steps: 2 });
    expect(costToReach([lv(10, 'builder_gold')], null, 1)).toBeNull();
  });
});

describe('checkAffordable', () => {
  it('alcanza cuando hay de sobra o justo', () => {
    expect(checkAffordable(cost({ gold: 100 }), res(100, 0, 0))).toEqual({ status: 'enough' });
    expect(checkAffordable(cost({ gold: 100, elixir: 50, dark: 5 }), res(500, 50, 9))).toEqual({ status: 'enough' });
  });

  it('indica cuánto falta de cada recurso', () => {
    expect(checkAffordable(cost({ gold: 1000, elixir: 500 }), res(400, 800, null))).toEqual({
      status: 'short',
      missing: [{ resource: 'gold', amount: 600 }],
    });
    expect(checkAffordable(cost({ gold: 10, elixir: 90, dark: 7 }), res(0, 0, 2))).toEqual({
      status: 'short',
      missing: [
        { resource: 'gold', amount: 10 },
        { resource: 'elixir', amount: 90 },
        { resource: 'dark', amount: 5 },
      ],
    });
  });

  it('no se sabe si falta registrar un recurso que hace falta, pero no importa el que no hace falta', () => {
    expect(checkAffordable(cost({ gold: 100 }), res(null, 999, 999))).toEqual({ status: 'unknown' });
    expect(checkAffordable(cost({ dark: 1 }), res(999, 999, null))).toEqual({ status: 'unknown' });
    expect(checkAffordable(cost({ gold: 100 }), res(500, null, null))).toEqual({ status: 'enough' });
  });

  it('"oro o elixir" se paga con lo que sobre de cualquiera de los dos', () => {
    // Sobran 300 de oro y 500 de elixir: alcanza para 800.
    expect(checkAffordable(cost({ goldOrElixir: 800 }), res(300, 500, 0))).toEqual({ status: 'enough' });
    expect(checkAffordable(cost({ goldOrElixir: 801 }), res(300, 500, 0))).toEqual({
      status: 'short',
      missing: [{ resource: 'gold_or_elixir', amount: 1 }],
    });
    // Lo que ya se gasta en oro no puede gastarse otra vez: 1000 de oro, 600 se van, sobran 400.
    expect(checkAffordable(cost({ gold: 600, goldOrElixir: 450 }), res(1000, 0, 0))).toEqual({
      status: 'short',
      missing: [{ resource: 'gold_or_elixir', amount: 50 }],
    });
  });

  it('para "oro o elixir" hacen falta registrados los dos', () => {
    expect(checkAffordable(cost({ goldOrElixir: 10 }), res(100, null, 0))).toEqual({ status: 'unknown' });
  });

  it('un costo de cero siempre alcanza', () => {
    expect(checkAffordable(cost({}), res(null, null, null))).toEqual({ status: 'enough' });
  });
});

describe('suggestionCost con el catálogo real', () => {
  const INFERNO = 1000027;

  it('el nivel 1 de la Torre infernal sin tenerla cuesta 1 000 000 de oro', () => {
    expect(suggestionCost(INFERNO, 1, new Map())).toMatchObject({ gold: 1_000_000, steps: 1, fromLevel: null, seconds: 12 * 3600 });
  });

  it('desde el nivel actual del export suma cada paso', () => {
    const one = suggestionCost(INFERNO, 8, new Map([[INFERNO, 7]]));
    const two = suggestionCost(INFERNO, 9, new Map([[INFERNO, 7]]));
    expect(one).toMatchObject({ steps: 1, fromLevel: 7 });
    expect(two?.steps).toBe(2);
    expect(two!.gold).toBeGreaterThan(one!.gold);
  });

  it('devuelve null sin elemento, sin nivel, o con un nivel que no existe', () => {
    expect(suggestionCost(null, 5, new Map())).toBeNull();
    expect(suggestionCost(INFERNO, null, new Map())).toBeNull();
    expect(suggestionCost(INFERNO, 999, new Map())).toBeNull();
    expect(suggestionCost(90000000, 5, new Map())).toBeNull(); // equipo de héroe: sin costos
  });
});

describe('describeCost / describeMissing', () => {
  it('escribe los costos en español', () => {
    expect(describeCost(cost({ elixir: 4_250_000, gold: 120_000 }))).toBe('120,000 de oro y 4.25M de elixir');
    expect(describeCost(cost({ dark: 85_000 }))).toBe('85,000 de elixir oscuro');
    expect(describeCost(cost({}))).toBe('Sin costo');
  });

  it('escribe lo que falta', () => {
    expect(describeMissing([{ resource: 'elixir', amount: 1_100_000 }, { resource: 'gold', amount: 20_000 }])).toBe(
      '1.1M de elixir y 20,000 de oro',
    );
  });
});

describe('evaluateSuggestion', () => {
  const INFERNO = 1000027;
  const levels = (n: number) => new Map([[INFERNO, n]]);

  it('una sugerencia de texto libre no tiene nada que calcular', () => {
    expect(evaluateSuggestion(null, 5, new Map(), res(1, 1, 1))).toEqual({ kind: 'free_text' });
  });

  it('sin nivel objetivo, o con un nivel que no existe, no hay costo', () => {
    expect(evaluateSuggestion(INFERNO, null, levels(7), res(1, 1, 1))).toEqual({ kind: 'no_cost' });
    expect(evaluateSuggestion(INFERNO, 999, levels(7), res(1, 1, 1))).toEqual({ kind: 'no_cost' });
  });

  it('si ya lo tiene en ese nivel o más, lo dice', () => {
    expect(evaluateSuggestion(INFERNO, 7, levels(9), res(0, 0, 0))).toEqual({ kind: 'already', fromLevel: 9 });
  });

  it('calcula el costo del siguiente nivel y compara con los recursos', () => {
    const rich = evaluateSuggestion(INFERNO, 8, levels(7), res(1_000_000_000, 0, 0));
    expect(rich).toMatchObject({ kind: 'cost', fromLevel: 7, steps: 1, affordability: { status: 'enough' } });

    const poor = evaluateSuggestion(INFERNO, 8, levels(7), res(1000, 0, 0));
    expect(poor).toMatchObject({ kind: 'cost', affordability: { status: 'short' } });
    if (poor.kind === 'cost' && poor.affordability.status === 'short') {
      expect(poor.affordability.missing).toEqual([{ resource: 'gold', amount: poor.cost.gold - 1000 }]);
    }

    expect(evaluateSuggestion(INFERNO, 8, levels(7), res(null, null, null))).toMatchObject({
      kind: 'cost',
      affordability: { status: 'unknown' },
    });
  });

  it('sin el elemento en el export solo cuenta el nivel objetivo', () => {
    expect(evaluateSuggestion(INFERNO, 3, new Map(), res(0, 0, 0))).toMatchObject({ kind: 'cost', fromLevel: null, steps: 1 });
  });
});
