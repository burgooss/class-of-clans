import { BUILDER_HUT_ID, TOWN_HALL_ID } from '@/export/ids';

import { displayTargetLevel } from './builders';

// Solo los IDs confirmados. El resto necesita un catálogo (después de v1).
const KNOWN_NAMES: Record<number, string> = {
  [TOWN_HALL_ID]: 'Ayuntamiento',
  [BUILDER_HUT_ID]: 'Cabaña de constructor',
};

export function upgradeName(gameId: number, name: string | null): string {
  return name ?? KNOWN_NAMES[gameId] ?? `Mejora (ID ${gameId})`;
}

/** " → nivel N" para una mejora en curso, o cadena vacía si no hay nivel. */
export function levelSuffix(storedLevel: number | null): string {
  const level = displayTargetLevel(storedLevel);
  return level === null ? '' : ` → nivel ${level}`;
}
