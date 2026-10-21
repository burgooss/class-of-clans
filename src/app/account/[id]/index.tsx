import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AliasModal } from '@/components/AliasModal';
import { AccountError, deleteAccount, renameAccount } from '@/db/accounts';
import {
  type Account,
  type ActiveUpgrade,
  getAccount,
  getBuilderUpgrades,
  getLastCapturedAt,
} from '@/db/queries';
import { displayTargetLevel, freeBuilderCount, runningUpgrades } from '@/domain/builders';
import { formatAgo, formatRemaining, STALE_EXPORT_SECONDS } from '@/domain/format';
import { upgradeName } from '@/domain/names';
import { useNow } from '@/hooks/useNow';

type Data = { account: Account; upgrades: ActiveUpgrade[]; capturedAt: number | null };

function levelText(stored: number | null): string {
  const level = displayTargetLevel(stored);
  return level === null ? '' : ` → nivel ${level}`;
}

export default function AccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const now = useNow();
  const [data, setData] = useState<Data | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const accountId = Number(id);
    const account = await getAccount(db, accountId);
    if (!account) return setData(null);
    const [upgrades, capturedAt] = await Promise.all([
      getBuilderUpgrades(db, accountId),
      getLastCapturedAt(db, accountId),
    ]);
    setData({ account, upgrades, capturedAt });
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function failure(error: unknown) {
    const message = error instanceof AccountError ? error.message : 'No se pudo completar la acción. No se cambió nada.';
    Alert.alert('Error', message);
  }

  async function rename(alias: string) {
    setBusy(true);
    try {
      await renameAccount(db, Number(id), alias);
      setRenaming(false);
      await load();
    } catch (error) {
      setRenaming(false);
      failure(error);
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete(alias: string) {
    Alert.alert(
      `¿Borrar "${alias}"?`,
      'Se borran sus exports, mejoras y sugerencias. Las bases y ejércitos asociados se conservan y quedan disponibles para todas las cuentas. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount(db, Number(id));
              router.back();
            } catch (error) {
              failure(error);
            }
          },
        },
      ],
    );
  }

  if (!data) return null;
  const { account, upgrades, capturedAt } = data;

  const timed = upgrades.map((u) => ({ ...u, gameId: u.game_id, endsAt: u.ends_at }));
  const running = runningUpgrades(timed, now);
  const finished = timed.filter((u) => u.endsAt <= now);
  const free = freeBuilderCount(account.builder_count, timed, now) ?? 0;
  const stale = capturedAt !== null && now - capturedAt > STALE_EXPORT_SECONDS;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.alias}>{account.alias}</Text>
      <Text style={styles.meta}>
        {account.tag} · Ayuntamiento {account.town_hall ?? '—'} · {account.builder_count ?? '—'} constructores
      </Text>
      {capturedAt !== null && (
        <Text style={styles.meta}>Última actualización: {formatAgo(now - capturedAt)}</Text>
      )}
      {stale && (
        <View style={styles.warning}>
          <Text style={styles.warningText}>
            Este export tiene más de 24 h. Vuelve a exportar desde el juego para ver datos actuales.
          </Text>
        </View>
      )}

      <Text style={styles.section}>Constructores</Text>
      {running.map((u) => (
        <View key={u.id} style={styles.card}>
          <View style={styles.cardText}>
            <Text style={styles.name}>{upgradeName(u.game_id, u.name)}</Text>
            <Text style={styles.detail}>{levelText(u.target_level).trim()}</Text>
          </View>
          <Text style={styles.countdown}>{formatRemaining(u.endsAt - now)}</Text>
        </View>
      ))}
      {Array.from({ length: free }, (_, i) => (
        <View key={`free-${i}`} style={[styles.card, styles.freeCard]}>
          <Text style={styles.freeText}>Libre</Text>
        </View>
      ))}
      {running.length === 0 && free === 0 && <Text style={styles.meta}>Sin datos de constructores.</Text>}

      {finished.length > 0 && (
        <>
          <Text style={styles.section}>Terminadas desde el último export</Text>
          {finished.map((u) => (
            <Text key={u.id} style={styles.meta}>
              ✓ {upgradeName(u.game_id, u.name)}
              {levelText(u.target_level)}
            </Text>
          ))}
        </>
      )}

      <Link href={{ pathname: '/account/[id]/suggestions', params: { id } }} style={styles.link}>
        Sugerencias
      </Link>

      <Text style={styles.section}>Cuenta</Text>
      <Pressable style={styles.action} onPress={() => setRenaming(true)}>
        <Text style={styles.actionText}>Renombrar</Text>
      </Pressable>
      <Pressable style={styles.action} onPress={() => confirmDelete(account.alias)}>
        <Text style={[styles.actionText, styles.danger]}>Borrar cuenta</Text>
      </Pressable>

      <AliasModal
        visible={renaming}
        title="Renombrar cuenta"
        subtitle={account.tag}
        initialValue={account.alias}
        busy={busy}
        onConfirm={rename}
        onCancel={() => setRenaming(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8 },
  alias: { fontSize: 22, fontWeight: '700' },
  meta: { fontSize: 13, opacity: 0.7 },
  warning: { backgroundColor: '#fef3c7', padding: 12, borderRadius: 10, marginTop: 4 },
  warningText: { color: '#92400e', fontSize: 14 },
  section: { fontSize: 15, fontWeight: '600', marginTop: 16 },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.12)',
    gap: 12,
  },
  cardText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600' },
  detail: { fontSize: 13, opacity: 0.7 },
  countdown: { fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '600' },
  freeCard: { backgroundColor: '#dcfce7' },
  freeText: { color: '#15803d', fontSize: 15, fontWeight: '600' },
  link: { marginTop: 24, fontSize: 16, color: '#2563eb' },
  action: { padding: 14, borderRadius: 12, backgroundColor: 'rgba(128,128,128,0.12)' },
  actionText: { fontSize: 15, fontWeight: '600' },
  danger: { color: '#b91c1c' },
});
