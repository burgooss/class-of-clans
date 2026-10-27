// Niveles actuales de cada elemento del juego según un export. Módulo puro, sin React.

// Listas de la aldea principal con elementos que tienen nivel. No se incluyen las de la base del
// constructor (sufijo "2") ni el equipo de héroe: la app no compara recursos de esos.
const LEVEL_LISTS = ['buildings', 'traps', 'units', 'siege_machines', 'heroes', 'spells', 'pets'] as const;

/**
 * Nivel actual de cada elemento (por ID). Si hay varios del mismo (cañones, muros…) se usa el de
 * menor nivel, que es el siguiente que se querría mejorar. Un texto que no es un export válido da
 * un mapa vacío en lugar de lanzar error.
 */
export function currentLevels(rawJson: string): Map<number, number> {
  const levels = new Map<number, number>();
  let root: unknown;
  try {
    root = JSON.parse(rawJson);
  } catch {
    return levels;
  }
  if (typeof root !== 'object' || root === null) return levels;

  for (const list of LEVEL_LISTS) {
    const items = (root as Record<string, unknown>)[list];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (typeof item !== 'object' || item === null) continue;
      const { data, lvl } = item as { data?: unknown; lvl?: unknown };
      if (typeof data !== 'number' || typeof lvl !== 'number') continue;
      const known = levels.get(data);
      if (known === undefined || lvl < known) levels.set(data, lvl);
    }
  }
  return levels;
}
