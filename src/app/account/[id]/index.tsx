import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Text } from '@/components/Text';
import { AliasModal } from '@/components/AliasModal';
import { reportLoadError } from '@/db/closed';
import { AccountError, deleteAccount, renameAccount, setNotificationsEnabled } from '@/db/accounts';
import {
  type Account,
  type ActiveUpgrade,
  getAccount,
  getUpgrades,
  getLastCapturedAt,
} from '@/db/queries';
import { freeBuilderCount } from '@/domain/builders';
import { formatAgo, formatRemaining, STALE_EXPORT_SECONDS } from '@/domain/format';
import { levelSuffix, upgradeName } from '@/domain/names';
import { groupBySlot, SLOT_LABEL, SLOT_ORDER } from '@/domain/upgrades';
import { useNow } from '@/hooks/useNow';
import { PERMISSION_HELP, syncNow } from '@/notifications';
import { colors } from '@/theme';

type Data = { account: Account; upgrades: ActiveUpgrade[]; capturedAt: number | null };

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
      getUpgrades(db, accountId),
      getLastCapturedAt(db, accountId),
    ]);
    setData({ account, upgrades, capturedAt });
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load().catch(reportLoadError);
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
      await syncNow(db);
    } catch (error) {
      setRenaming(false);
      failure(error);
    } finally {
      setBusy(false);
    }
  }

  async function toggleNotifications(enabled: boolean) {
    try {
      await setNotificationsEnabled(db, Number(id), enabled);
      await load();
      const sync = await syncNow(db);
      if (enabled && sync?.permissionDenied) Alert.alert('Notificaciones bloqueadas', PERMISSION_HELP);
    } catch (error) {
      failure(error);
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
              await syncNow(db);
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

  const groups = groupBySlot(upgrades, now);
  const builderTimed = upgrades
    .filter((u) => u.slot_type === 'builder')
    .map((u) => ({ gameId: u.game_id, endsAt: u.ends_at }));
  const free = freeBuilderCount(account.builder_count, builderTimed, now) ?? 0;
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

      <View style={styles.switchRow}>
        <Text style={styles.switchLabel}>Avisarme cuando termine una mejora (constructores, laboratorio y mascotas)</Text>
        <Switch value={account.notifications_on === 1} onValueChange={toggleNotifications} />
      </View>

      {SLOT_ORDER.map((slot) => {
        const group = groups.find((g) => g.slot === slot);
        // Constructores se muestra siempre (tiene los espacios libres); el resto, solo si hay algo.
        if (!group && slot !== 'builder') return null;
        const running = group?.running ?? [];
        const finished = group?.finished ?? [];
        const freeSlots = slot === 'builder' ? free : 0;
        return (
          <View key={slot} style={styles.group}>
            <Text style={styles.section}>{SLOT_LABEL[slot]}</Text>
            {running.map((u) => (
              <View key={u.id} style={styles.card}>
                <View style={styles.cardText}>
                  <Text style={styles.name}>{upgradeName(u.game_id, u.name)}</Text>
                  <Text style={styles.detail}>{levelSuffix(u.target_level).trim()}</Text>
                </View>
                <Text style={styles.countdown}>{formatRemaining(u.ends_at - now)}</Text>
              </View>
            ))}
            {Array.from({ length: freeSlots }, (_, i) => (
              <View key={`free-${i}`} style={[styles.card, styles.freeCard]}>
                <Text style={styles.freeText}>Libre</Text>
              </View>
            ))}
            {running.length === 0 && freeSlots === 0 && slot === 'builder' && (
              <Text style={styles.meta}>Sin datos de constructores.</Text>
            )}
            {finished.map((u) => (
              <Text key={u.id} style={styles.meta}>
                ✓ Terminó: {upgradeName(u.game_id, u.name)}
                {levelSuffix(u.target_level)}
              </Text>
            ))}
          </View>
        );
      })}

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
  group: { gap: 8 },
  alias: { fontSize: 22, fontWeight: '700' },
  meta: { fontSize: 13, opacity: 0.7 },
  warning: { backgroundColor: colors.warningBg, padding: 12, borderRadius: 10, marginTop: 4 },
  warningText: { color: colors.warningText, fontSize: 14 },
  section: { fontSize: 15, fontWeight: '600', marginTop: 16 },
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    gap: 12,
  },
  cardText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600' },
  detail: { fontSize: 13, opacity: 0.7 },
  countdown: { fontSize: 15, fontVariant: ['tabular-nums'], fontWeight: '600' },
  freeCard: { backgroundColor: colors.successBg },
  freeText: { color: colors.success, fontSize: 15, fontWeight: '600' },
  link: { marginTop: 24, fontSize: 16, color: colors.accent },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 8 },
  switchLabel: { flex: 1, fontSize: 15 },
  action: { padding: 14, borderRadius: 12, backgroundColor: colors.surface },
  actionText: { fontSize: 15, fontWeight: '600' },
  danger: { color: colors.danger },
});
