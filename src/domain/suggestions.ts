import { type OptionalIntParse, parseOptionalInt } from './numbers';

export type SuggestionStatus = 'pending' | 'in_progress' | 'done';

export const STATUS_LABEL: Record<SuggestionStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En curso',
  done: 'Hecha',
};

const STATUS_CYCLE: SuggestionStatus[] = ['pending', 'in_progress', 'done'];

/** Siguiente estado al tocar la etiqueta: pendiente → en curso → hecha → pendiente. */
export function nextStatus(status: SuggestionStatus): SuggestionStatus {
  return STATUS_CYCLE[(STATUS_CYCLE.indexOf(status) + 1) % STATUS_CYCLE.length];
}

export const MAX_TARGET_LEVEL = 999;

export type LevelParse = OptionalIntParse;

/** Nivel objetivo escrito por el usuario: vacío es válido (sin nivel); si no, entero de 1 a 999. */
export function parseTargetLevel(text: string): LevelParse {
  return parseOptionalInt(text, 1, MAX_TARGET_LEVEL);
}

export type OrderItem = { id: number; hidden: boolean };

/**
 * Nuevo orden de los IDs al mover un elemento una posición visible hacia arriba o abajo.
 * Salta los elementos ocultos (por ejemplo, las hechas cuando están ocultas), que
 * conservan su sitio relativo. Devuelve null si no se puede mover (ya está en el extremo
 * o el ID no existe).
 */
export function moveWithin(items: OrderItem[], id: number, direction: 'up' | 'down'): number[] | null {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const step = direction === 'up' ? -1 : 1;
  let target = index + step;
  while (target >= 0 && target < items.length && items[target].hidden) target += step;
  if (target < 0 || target >= items.length) return null;

  const ids = items.map((item) => item.id);
  ids.splice(index, 1);
  ids.splice(target, 0, id);
  return ids;
}
