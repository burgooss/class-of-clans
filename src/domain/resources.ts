import { type CatalogLevel, catalogLevels } from '@/catalog';

/** Recursos de la aldea principal que la app lleva. `null` = no registrado. */
export type Resources = { gold: number | null; elixir: number | null; dark: number | null };

export const MAX_AMOUNT = 9_999_999_999;

export type AmountParse = { ok: true; value: number | null } | { ok: false };

const MULTIPLIER: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 };

/**
 * Lee una cantidad escrita por el usuario. Acepta enteros ("1500000"), con separadores de miles
 * ("1,234,567", "1.234.567", "1 234 567") y con sufijo k/m/b ("850k", "1.5M", "1,5m"). Vacío es
 * válido y significa "no registrado". Un punto o coma sin sufijo solo vale como separador de miles.
 */
export function parseAmount(text: string): AmountParse {
  const trimmed = text.trim().toLowerCase();
  if (trimmed === '') return { ok: true, value: null };

  let value: number;
  const suffixed = /^(\d+(?:[.,]\d+)?)\s*([kmb])$/.exec(trimmed);
  if (suffixed) {
    value = Math.round(Number(suffixed[1].replace(',', '.')) * MULTIPLIER[suffixed[2]]);
  } else if (/^\d+$/.test(trimmed)) {
    value = Number(trimmed);
  } else if (/^\d{1,3}(?:[.,\s]\d{3})+$/.test(trimmed)) {
    value = Number(trimmed.replace(/[.,\s]/g, ''));
  } else {
    return { ok: false };
  }
  return value <= MAX_AMOUNT ? { ok: true, value } : { ok: false };
}

function trimZeros(text: string): string {
  return text.includes('.') ? text.replace(/0+$/, '').replace(/\.$/, '') : text;
}

/** "4.25M" desde un millón; por debajo, con separador de miles ("85,300"). */
export function formatAmount(amount: number): string {
  if (amount >= 1_000_000) return `${trimZeros((amount / 1_000_000).toFixed(2))}M`;
  return String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export type HomeResource = 'gold' | 'elixir' | 'dark' | 'gold_or_elixir';

export const RESOURCE_LABEL: Record<HomeResource, string> = {
  gold: 'oro',
  elixir: 'elixir',
  dark: 'elixir oscuro',
  gold_or_elixir: 'oro o elixir',
};

/** Lo que cuesta una mejora, por tipo de recurso, y lo que tarda. */
export type Cost = { gold: number; elixir: number; dark: number; goldOrElixir: number; seconds: number };

/**
 * Costo de subir un elemento hasta `toLevel`: la suma de los niveles desde `fromLevel + 1`.
 * Sin `fromLevel` (no está en el export) solo cuenta el nivel `toLevel`.
 *
 * @returns null si el catálogo no tiene costos del elemento, si `toLevel` no existe o si algún
 *   nivel necesita un recurso que la app no lleva. Si ya está en `toLevel` o más, el costo es 0.
 */
export function costToReach(levels: CatalogLevel[], fromLevel: number | null, toLevel: number): (Cost & { steps: number }) | null {
  if (levels.length === 0 || !Number.isInteger(toLevel) || toLevel < 1 || toLevel > levels.length) return null;

  const first = fromLevel === null ? toLevel : Math.max(fromLevel + 1, 1);
  const cost: Cost & { steps: number } = { gold: 0, elixir: 0, dark: 0, goldOrElixir: 0, seconds: 0, steps: 0 };
  for (let level = first; level <= toLevel; level++) {
    const step = levels[level - 1];
    switch (step.resource) {
      case 'gold':
        cost.gold += step.cost;
        break;
      case 'elixir':
        cost.elixir += step.cost;
        break;
      case 'dark':
        cost.dark += step.cost;
        break;
      case 'gold_or_elixir':
        cost.goldOrElixir += step.cost;
        break;
      default:
        return null; // recursos de la base del constructor
    }
    cost.seconds += step.seconds;
    cost.steps++;
  }
  return cost;
}

export type Affordability =
  | { status: 'enough' }
  | { status: 'short'; missing: { resource: HomeResource; amount: number }[] }
  | { status: 'unknown' };

/**
 * Compara un costo con los recursos registrados. Lo que cuesta "oro o elixir" se paga con lo que
 * sobre de cualquiera de los dos. Si falta registrar un recurso que hace falta, no se puede saber.
 */
export function checkAffordable(cost: Cost, resources: Resources): Affordability {
  const needsEither = cost.goldOrElixir > 0;
  const missingInfo =
    (cost.gold > 0 && resources.gold === null) ||
    (cost.elixir > 0 && resources.elixir === null) ||
    (cost.dark > 0 && resources.dark === null) ||
    (needsEither && (resources.gold === null || resources.elixir === null));
  if (missingInfo) return { status: 'unknown' };

  const gold = resources.gold ?? 0;
  const elixir = resources.elixir ?? 0;
  const dark = resources.dark ?? 0;
  const missing: { resource: HomeResource; amount: number }[] = [];

  if (cost.gold > gold) missing.push({ resource: 'gold', amount: cost.gold - gold });
  if (cost.elixir > elixir) missing.push({ resource: 'elixir', amount: cost.elixir - elixir });
  if (cost.dark > dark) missing.push({ resource: 'dark', amount: cost.dark - dark });
  if (needsEither) {
    const spare = Math.max(0, gold - cost.gold) + Math.max(0, elixir - cost.elixir);
    if (cost.goldOrElixir > spare) missing.push({ resource: 'gold_or_elixir', amount: cost.goldOrElixir - spare });
  }
  return missing.length === 0 ? { status: 'enough' } : { status: 'short', missing };
}

/** Costo de una sugerencia con elemento del catálogo; null si no se puede calcular. */
export function suggestionCost(
  gameId: number | null,
  targetLevel: number | null,
  currentLevels: Map<number, number>,
): (Cost & { steps: number; fromLevel: number | null }) | null {
  if (gameId === null || targetLevel === null) return null;
  const fromLevel = currentLevels.get(gameId) ?? null;
  const cost = costToReach(catalogLevels(gameId), fromLevel, targetLevel);
  return cost && { ...cost, fromLevel };
}

/** Texto del costo: "4.25M de elixir y 120k de oro". */
export function describeCost(cost: Cost): string {
  const parts: string[] = [];
  if (cost.gold > 0) parts.push(`${formatAmount(cost.gold)} de ${RESOURCE_LABEL.gold}`);
  if (cost.elixir > 0) parts.push(`${formatAmount(cost.elixir)} de ${RESOURCE_LABEL.elixir}`);
  if (cost.dark > 0) parts.push(`${formatAmount(cost.dark)} de ${RESOURCE_LABEL.dark}`);
  if (cost.goldOrElixir > 0) parts.push(`${formatAmount(cost.goldOrElixir)} de ${RESOURCE_LABEL.gold_or_elixir}`);
  return parts.length === 0 ? 'Sin costo' : parts.join(' y ');
}

/** Texto de lo que falta: "1.1M de elixir y 20k de oro". */
export function describeMissing(missing: { resource: HomeResource; amount: number }[]): string {
  return missing.map((m) => `${formatAmount(m.amount)} de ${RESOURCE_LABEL[m.resource]}`).join(' y ');
}

export type SuggestionEvaluation =
  /** Sugerencia de texto libre: no hay nada que calcular. */
  | { kind: 'free_text' }
  /** Tiene elemento pero falta el nivel objetivo, o el catálogo no tiene costos para ese nivel. */
  | { kind: 'no_cost' }
  /** El elemento ya está en el nivel objetivo o más. */
  | { kind: 'already'; fromLevel: number }
  | { kind: 'cost'; cost: Cost; fromLevel: number | null; steps: number; affordability: Affordability };

/**
 * Qué costaría una sugerencia y si alcanza con los recursos registrados.
 * @param currentLevels Nivel actual de cada elemento en el último export (ver `currentLevels`).
 */
export function evaluateSuggestion(
  gameId: number | null,
  targetLevel: number | null,
  currentLevels: Map<number, number>,
  resources: Resources,
): SuggestionEvaluation {
  if (gameId === null) return { kind: 'free_text' };
  const result = suggestionCost(gameId, targetLevel, currentLevels);
  if (!result) return { kind: 'no_cost' };
  const { steps, fromLevel, ...cost } = result;
  if (steps === 0 && fromLevel !== null) return { kind: 'already', fromLevel };
  return { kind: 'cost', cost, fromLevel, steps, affordability: checkAffordable(cost, resources) };
}
