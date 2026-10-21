import { freeBuilderCount, nextFreeAt, type TimedUpgrade } from './builders';

export type OverviewAccount = {
  id: number;
  alias: string;
  tag: string;
  builderCount: number | null;
};

export type OverviewRow = {
  accountId: number;
  alias: string;
  tag: string;
  /** null si no se conoce el total de constructores de la cuenta. */
  freeNow: number | null;
  /** Próxima hora en que termina una mejora, o null si no hay ninguna en curso. */
  nextFreeAt: number | null;
};

// Grupo 0: con constructores libres ahora. Grupo 1: el resto, por la próxima liberación.
// Grupo 2: sin información de mejoras en curso.
function group(row: OverviewRow): 0 | 1 | 2 {
  if (row.freeNow !== null && row.freeNow > 0) return 0;
  return row.nextFreeAt !== null ? 1 : 2;
}

/** Filas de la vista general, con el constructor que queda libre primero arriba. */
export function buildOverview(
  accounts: OverviewAccount[],
  upgradesByAccount: Map<number, TimedUpgrade[]>,
  now: number,
): OverviewRow[] {
  const rows = accounts.map<OverviewRow>((account) => {
    const upgrades = upgradesByAccount.get(account.id) ?? [];
    return {
      accountId: account.id,
      alias: account.alias,
      tag: account.tag,
      freeNow: freeBuilderCount(account.builderCount, upgrades, now),
      nextFreeAt: nextFreeAt(upgrades, now),
    };
  });

  return rows.sort((a, b) => {
    const byGroup = group(a) - group(b);
    if (byGroup !== 0) return byGroup;
    if (group(a) === 1) {
      const byTime = (a.nextFreeAt ?? 0) - (b.nextFreeAt ?? 0);
      if (byTime !== 0) return byTime;
    }
    return a.alias.localeCompare(b.alias, 'es', { sensitivity: 'base' });
  });
}
