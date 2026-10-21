import { type OptionalIntParse, parseOptionalInt } from './numbers';

/** Bases (`layouts`) y ejércitos (`armies`): misma forma, distinta tabla y categorías. */
export type Collection = 'layouts' | 'armies';
export type LinkCategory = 'war' | 'trophy' | 'farm' | 'other';

export type CollectionConfig = {
  table: Collection;
  /** Columna donde se guarda la categoría: `kind` en bases, `purpose` en ejércitos. */
  column: 'kind' | 'purpose';
  categories: LinkCategory[];
  title: string;
  singular: string;
  categoryTitle: string;
};

export const COLLECTIONS: Record<Collection, CollectionConfig> = {
  layouts: {
    table: 'layouts',
    column: 'kind',
    categories: ['war', 'trophy', 'farm', 'other'],
    title: 'Bases',
    singular: 'base',
    categoryTitle: 'Tipo',
  },
  armies: {
    table: 'armies',
    column: 'purpose',
    categories: ['war', 'farm', 'other'],
    title: 'Ejércitos',
    singular: 'ejército',
    categoryTitle: 'Uso',
  },
};

export const CATEGORY_LABEL: Record<LinkCategory, string> = {
  war: 'Guerra',
  trophy: 'Trofeos',
  farm: 'Farmeo',
  other: 'Otro',
};

export const MAX_TOWN_HALL = 30;

export function parseTownHall(text: string): OptionalIntParse {
  return parseOptionalInt(text, 1, MAX_TOWN_HALL);
}

export type UrlParse = { ok: true; url: string } | { ok: false };

/**
 * Valida un link pegado por el usuario. Solo exige que sea http(s) con host: no se asume
 * ningún formato del juego mientras no se verifique con links reales (ver Fase 7).
 */
export function parseLinkUrl(text: string): UrlParse {
  const trimmed = text.trim();
  if (!/^https?:\/\/[^\s/?#]+\S*$/i.test(trimmed)) return { ok: false };
  return { ok: true, url: trimmed };
}

export type LinkFilter = { townHall: number | null; category: LinkCategory | null };

/** Aplica los filtros de ayuntamiento y categoría. Un elemento sin ayuntamiento no pasa el filtro de ayuntamiento. */
export function filterLinks<T extends { town_hall: number | null; category: LinkCategory }>(
  items: T[],
  filter: LinkFilter,
): T[] {
  return items.filter(
    (item) =>
      (filter.townHall === null || item.town_hall === filter.townHall) &&
      (filter.category === null || item.category === filter.category),
  );
}

/** Ayuntamientos distintos presentes en la lista, de mayor a menor. */
export function townHallsIn(items: { town_hall: number | null }[]): number[] {
  const set = new Set<number>();
  for (const item of items) if (item.town_hall !== null) set.add(item.town_hall);
  return [...set].sort((a, b) => b - a);
}
