import { catalogName } from '@/catalog';

/** Nombre legible de una mejora: el guardado, si lo hay; si no el del catálogo; si no, el ID. */
export function upgradeName(gameId: number, name: string | null): string {
  return name ?? catalogName(gameId) ?? `Mejora (ID ${gameId})`;
}

/** " → nivel N" para una mejora en curso (N es el nivel al que sube), o cadena vacía si no se conoce. */
export function levelSuffix(targetLevel: number | null): string {
  return targetLevel === null ? '' : ` → nivel ${targetLevel}`;
}
