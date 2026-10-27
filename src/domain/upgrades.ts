import type { SlotType } from '@/export';

/** Orden en que se muestran los tipos de espacio. */
export const SLOT_ORDER: SlotType[] = ['builder', 'lab', 'pet_house', 'builder_base', 'other'];

export const SLOT_LABEL: Record<SlotType, string> = {
  builder: 'Constructores',
  lab: 'Laboratorio',
  pet_house: 'Casa de mascotas',
  builder_base: 'Base del constructor',
  other: 'Otras mejoras',
};

export type SlotGroup<T> = {
  slot: SlotType;
  /** En curso (terminan después de `now`), de la que termina antes a la que termina después. */
  running: T[];
  /** Ya terminaron según la hora actual, pero el export es anterior: las más recientes primero. */
  finished: T[];
};

function slotOf(value: string): SlotType {
  return (SLOT_ORDER as string[]).includes(value) ? (value as SlotType) : 'other';
}

/**
 * Agrupa las mejoras por tipo de espacio (constructores, laboratorio, casa de mascotas…).
 * Solo devuelve los grupos que tienen algo, en el orden de SLOT_ORDER.
 */
export function groupBySlot<T extends { slot_type: string; ends_at: number }>(upgrades: T[], now: number): SlotGroup<T>[] {
  const groups = new Map<SlotType, SlotGroup<T>>();
  for (const upgrade of upgrades) {
    const slot = slotOf(upgrade.slot_type);
    const group = groups.get(slot) ?? { slot, running: [], finished: [] };
    (upgrade.ends_at > now ? group.running : group.finished).push(upgrade);
    groups.set(slot, group);
  }
  for (const group of groups.values()) {
    group.running.sort((a, b) => a.ends_at - b.ends_at);
    group.finished.sort((a, b) => b.ends_at - a.ends_at);
  }
  return SLOT_ORDER.filter((slot) => groups.has(slot)).map((slot) => groups.get(slot)!);
}
