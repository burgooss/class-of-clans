import { BUILDER_HUT_ID } from '@/export/ids';

// SUPOSICIÓN PROVISIONAL (duda 3 de docs/formato-export.md): mejorar una cabaña de
// constructor ocupa un constructor, igual que cualquier otra mejora de tipo `builder`.
// Los 3 ejemplos son coherentes con esto (todos los constructores aparecen ocupados),
// pero no se ha confirmado. Si resulta falso, poner `false`.
export const HUT_UPGRADE_OCCUPIES_BUILDER = true;

/** Lo mínimo que necesita el cálculo de una mejora de constructor. */
export type TimedUpgrade = { gameId: number; endsAt: number };

function occupiesBuilder(upgrade: TimedUpgrade): boolean {
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

// SUPOSICIÓN PROVISIONAL (duda 4 de docs/formato-export.md): mientras una mejora está en
// curso, `lvl` del export es el nivel al que va a subir. En la base se guarda tal cual
// viene (`active_upgrades.target_level`). Si resulta ser el nivel actual, poner `false`
// y la interfaz mostrará `lvl + 1`.
export const LVL_IS_TARGET_LEVEL = true;

/** Nivel al que sube una mejora en curso, a partir del `lvl` guardado. */
export function displayTargetLevel(storedLevel: number | null): number | null {
  if (storedLevel === null) return null;
  return LVL_IS_TARGET_LEVEL ? storedLevel : storedLevel + 1;
}
