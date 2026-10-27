import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { ImportButton } from '@/components/ImportButton';
import { type Account, type ActiveUpgrade, getAccounts, getAllUpgrades } from '@/db/queries';
import { buildOverview, type OverviewRow, type OverviewUpgrade } from '@/domain/overview';
import { SLOT_LABEL } from '@/domain/upgrades';
import { formatRemaining } from '@/domain/format';
import { useNow } from '@/hooks/useNow';
import { colors } from '@/theme';

function freeLabel(row: OverviewRow): string {
  if (row.freeNow === null) return 'Constructores: —';
  return row.freeNow === 1 ? '1 libre ahora' : `${row.freeNow} libres ahora`;
}

export default function OverviewScreen() {
  const db = useSQLiteContext();
  const now = useNow();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [upgrades, setUpgrades] = useState<ActiveUpgrade[]>([]);

  const load = useCallback(async () => {
    const [accountRows, upgradeRows] = await Promise.all([getAccounts(db), getAllUpgrades(db)]);
    setAccounts(accountRows);
    setUpgrades(upgradeRows);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const rows = useMemo(() => {
    const byAccount = new Map<number, OverviewUpgrade[]>();
    for (const u of upgrades) {
      const list = byAccount.get(u.account_id) ?? [];
      list.push({ gameId: u.game_id, endsAt: u.ends_at, slot: u.slot_type });
      byAccount.set(u.account_id, list);
    }
    return buildOverview(
      accounts.map((a) => ({ id: a.id, alias: a.alias, tag: a.tag, builderCount: a.builder_count })),
      byAccount,
      now,
    );
  }, [accounts, upgrades, now]);

  return (
    <View style={styles.container}>
      <ImportButton onImported={load} />

      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Sin cuentas</Text>
          <Text style={styles.emptyNote}>
            En Clash of Clans: Ajustes → Data Export → Copiar. Luego vuelve aquí y toca "Pegar export".
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.accountId)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Link href={{ pathname: '/account/[id]', params: { id: item.accountId } }} asChild>
              <Pressable style={styles.row}>
                <View style={styles.rowHead}>
                  <Text style={styles.alias}>{item.alias}</Text>
                  <Text style={[styles.free, item.freeNow ? styles.freeOn : null]}>{freeLabel(item)}</Text>
                </View>
                <Text style={styles.next}>
                  {item.nextFreeAt === null
                    ? 'Sin mejoras en curso'
                    : `Siguiente en ${formatRemaining(item.nextFreeAt - now)}`}
                </Text>
                {item.extras.map((extra) => (
                  <Text key={extra.slot} style={styles.next}>
                    {SLOT_LABEL[extra.slot]}: {formatRemaining(extra.endsAt - now)}
                  </Text>
                ))}
              </Pressable>
            </Link>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  list: { gap: 8, paddingBottom: 16 },
  row: { padding: 16, borderRadius: 12, backgroundColor: colors.surface, gap: 4 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alias: { fontSize: 16, fontWeight: '600' },
  free: { fontSize: 14, opacity: 0.7 },
  freeOn: { color: colors.success, opacity: 1, fontWeight: '600' },
  next: { fontSize: 14, opacity: 0.7 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '600' },
  emptyNote: { fontSize: 14, opacity: 0.7, textAlign: 'center' },
});
