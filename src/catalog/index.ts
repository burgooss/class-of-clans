import data from './catalog.json';
import { NAMES_ES } from './names.es';

export type CostResource =
  | 'gold'
  | 'elixir'
  | 'dark'
  | 'gold_or_elixir'
  | 'builder_gold'
  | 'builder_elixir'
  | 'builder_gold_or_elixir';

/** Costo y tiempo de subir a un nivel. */
export type CatalogLevel = { cost: number; resource: CostResource; seconds: number };

// [nombre en inglés, categoría, base, niveles]. Generado por scripts/build-catalog.mjs;
// niveles[i] es el nivel i+1 y vale [costo, recurso, segundos] (vacío si no hay costos).
type Entry = [name: string, category: string, base: string, levels: [number, CostResource, number][]];
const items = data.items as unknown as Record<string, Entry>;

/** Fuente y licencia de los datos del catálogo. */
export const CATALOG_SOURCE: string = data.source;

/** Nombre en inglés del catálogo, o null si el ID no existe. */
export function catalogNameEn(gameId: number): string | null {
  return items[String(gameId)]?.[0] ?? null;
}

/** Nombre para mostrar: en español si se conoce (names.es.ts); si no, el del catálogo en inglés. */
export function catalogName(gameId: number): string | null {
  return NAMES_ES[gameId] ?? catalogNameEn(gameId);
}

export function catalogCategory(gameId: number): string | null {
  return items[String(gameId)]?.[1] ?? null;
}

/** Costo y tiempo de cada nivel (el índice 0 es el nivel 1). Vacío si el elemento no tiene costos. */
export function catalogLevels(gameId: number): CatalogLevel[] {
  const entry = items[String(gameId)];
  if (!entry) return [];
  return entry[3].map(([cost, resource, seconds]) => ({ cost, resource, seconds }));
}

export type CatalogItem = { id: number; name: string; nameEn: string; category: string; maxLevel: number };

const HOME_RESOURCES: CostResource[] = ['gold', 'elixir', 'dark', 'gold_or_elixir'];

/**
 * Elementos de la aldea principal que se pueden elegir en una sugerencia: los que tienen costos y
 * cuyos costos son todos de oro, elixir o elixir oscuro (los únicos recursos que la app lleva).
 */
export function pickableItems(): CatalogItem[] {
  const out: CatalogItem[] = [];
  for (const [id, [nameEn, category, base, levels]] of Object.entries(items)) {
    if (base !== 'home' || levels.length === 0) continue;
    if (!levels.every(([, resource]) => HOME_RESOURCES.includes(resource))) continue;
    const gameId = Number(id);
    out.push({ id: gameId, name: catalogName(gameId) ?? nameEn, nameEn, category, maxLevel: levels.length });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
}
