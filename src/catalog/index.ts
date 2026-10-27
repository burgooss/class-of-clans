import data from './catalog.json';

// [nombre, categoría, base]. Generado por scripts/build-catalog.mjs; los nombres están en inglés.
type Entry = [name: string, category: string, base: string];
const items = data.items as unknown as Record<string, Entry>;

/** Fuente y licencia de los datos del catálogo. */
export const CATALOG_SOURCE: string = data.source;

/** Nombre del elemento del juego con ese ID, o null si el catálogo no lo conoce. */
export function catalogName(gameId: number): string | null {
  return items[String(gameId)]?.[0] ?? null;
}
