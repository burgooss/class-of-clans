import { BUILDER_HUT_ID } from '@/export/ids';

// SUPOSICIÓN PROVISIONAL (duda 3 de docs/formato-export.md): mejorar una cabaña de
// constructor ocupa un constructor, igual que cualquier otra mejora de tipo `builder`.
// Los 3 ejemplos son coherentes con esto (todos los constructores aparecen ocupados),
// pero no se ha confirmado. Si resulta falso, poner `false`.
export const HUT_UPGRADE_OCCUPIES_BUILDER = true;

/** Lo mínimo que necesita el cálculo de una mejora de constructor. */
export type TimedUpgrade = { gameId: number; endsAt: number };

/** Si esta mejora ocupa un constructor (y por tanto libera uno al terminar). */
export function occupiesBuilder(upgrade: TimedUpgrade): boolean {
  return HUT_UPGRADE_OCCUPIES_BUILDER || upgrade.gameId !== BUILDER_HUT_ID;
}

/** Mejoras de constructor que siguen en curso y ocupan un constructor. */
export function runningUpgrades<T extends TimedUpgrade>(upgrades: T[], now: number): T[] {
  return upgrades.filter((u) => u.endsAt > now && occupiesBuilder(u));
}

/** Constructores libres ahora, o null si no se conoce el total de constructores. */
export function freeBuilderCount(
  builderCount: number | null,
  upgrades: TimedUpgrade[],
  now: number,
): number | null {
  if (builderCount === null) return null;
  return Math.max(0, builderCount - runningUpgrades(upgrades, now).length);
}

/** Próxima hora (epoch, segundos) en que termina una mejora en curso, o null si no hay. */
export function nextFreeAt(upgrades: TimedUpgrade[], now: number): number | null {
  const running = runningUpgrades(upgrades, now);
  if (running.length === 0) return null;
  return Math.min(...running.map((u) => u.endsAt));
}
