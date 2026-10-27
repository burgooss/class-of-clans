import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, View } from 'react-native';

import { ResourcesModal } from '@/components/ResourcesModal';
import { SuggestionModal } from '@/components/SuggestionModal';
import { Text } from '@/components/Text';
import { reportLoadError } from '@/db/closed';
import { AccountError, setResources } from '@/db/accounts';
import { type Account, getAccount, getLastExportJson } from '@/db/queries';
import {
  addSuggestion,
  deleteSuggestion,
  getSuggestions,
  moveSuggestion,
  setSuggestionStatus,
  type Suggestion,
  type SuggestionInput,
  SuggestionError,
  updateSuggestion,
} from '@/db/suggestions';
import { formatAgo, formatRemaining } from '@/domain/format';
import {
  describeCost,
  describeMissing,
  evaluateSuggestion,
  formatAmount,
  type Resources,
  type SuggestionEvaluation,
} from '@/domain/resources';
import { nextStatus, STATUS_LABEL } from '@/domain/suggestions';
import { currentLevels } from '@/export';
import { colors } from '@/theme';

/** "✓ Te alcanza", "Faltan 1.1M de elixir" o la indicación de registrar los recursos. */
function Affordable({ evaluation }: { evaluation: SuggestionEvaluation }) {
  if (evaluation.kind !== 'cost') return null;
  const { affordability } = evaluation;
  if (affordability.status === 'enough') return <Text style={styles.enough}>✓ Te alcanza</Text>;
  if (affordability.status === 'short') return <Text style={styles.short}>Faltan {describeMissing(affordability.missing)}</Text>;
  return <Text style={styles.meta}>Registra tus recursos para ver si te alcanza</Text>;
}

function EvaluationLines({ item, evaluation }: { item: Suggestion; evaluation: SuggestionEvaluation | undefined }) {
  if (!evaluation || evaluation.kind === 'free_text') return null;
  if (evaluation.kind === 'no_cost') return <Text style={styles.meta}>Pon un nivel objetivo válido para ver el costo.</Text>;
  if (evaluation.kind === 'already') return <Text style={styles.meta}>Ya está en nivel {evaluation.fromLevel} o más.</Text>;

  const range =
    evaluation.steps > 1 && evaluation.fromLevel !== null ? ` (niveles ${evaluation.fromLevel + 1} a ${item.target_level})` : '';
  return (
    <>
      <Text style={styles.meta}>
        Costo: {describeCost(evaluation.cost)} · {formatRemaining(evaluation.cost.seconds)}
        {range}
      </Text>
      <Affordable evaluation={evaluation} />
    </>
  );
}

// null = cerrado, 'new' = creando, Suggestion = editando.
type FormState = null | 'new' | Suggestion;

export default function SuggestionsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);
  const db = useSQLiteContext();
  const [all, setAll] = useState<Suggestion[]>([]);
  const [hideDone, setHideDone] = useState(false);
  const [form, setForm] = useState<FormState>(null);
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [levels, setLevels] = useState<Map<number, number>>(new Map());
  const [resourcesOpen, setResourcesOpen] = useState(false);

  const load = useCallback(async () => {
    const [suggestions, accountRow, exportJson] = await Promise.all([
      getSuggestions(db, accountId),
      getAccount(db, accountId),
      getLastExportJson(db, accountId),
    ]);
    setAll(suggestions);
    setAccount(accountRow);
    setLevels(exportJson === null ? new Map() : currentLevels(exportJson));
  }, [db, accountId]);

  useFocusEffect(
    useCallback(() => {
      load().catch(reportLoadError);
    }, [load]),
  );

  const visible = useMemo(() => (hideDone ? all.filter((s) => s.status !== 'done') : all), [all, hideDone]);
  const pending = all.filter((s) => s.status !== 'done').length;

  const resources: Resources = useMemo(
    () => ({ gold: account?.gold ?? null, elixir: account?.elixir ?? null, dark: account?.dark_elixir ?? null }),
    [account],
  );
  const resourcesSummary = useMemo(() => {
    const parts = [
      resources.gold !== null && `Oro ${formatAmount(resources.gold)}`,
      resources.elixir !== null && `Elixir ${formatAmount(resources.elixir)}`,
      resources.dark !== null && `Oscuro ${formatAmount(resources.dark)}`,
    ].filter(Boolean);
    return parts.length === 0 ? 'Sin registrar. Escríbelos para saber si te alcanzan.' : parts.join(' · ');
  }, [resources]);

  // Costo y "te alcanza" de cada sugerencia pendiente con elemento del catálogo.
  const evaluations = useMemo(() => {
    const map = new Map<number, SuggestionEvaluation>();
    for (const s of all) if (s.status !== 'done') map.set(s.id, evaluateSuggestion(s.game_id, s.target_level, levels, resources));
    return map;
  }, [all, levels, resources]);

  // La primera de la cola (sin contar las hechas) que tiene un costo por pagar.
  const nextUp = useMemo(() => {
    for (const s of all) {
      const evaluation = evaluations.get(s.id);
      if (evaluation?.kind === 'cost') return { suggestion: s, evaluation };
    }
    return null;
  }, [all, evaluations]);

  async function saveResources(next: Resources) {
    setBusy(true);
    try {
      await setResources(db, accountId, next, Math.floor(Date.now() / 1000));
      setResourcesOpen(false);
      await load();
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof AccountError ? error.message : 'Inténtalo de nuevo. No se cambió nada.');
    } finally {
      setBusy(false);
    }
  }

  // Ejecuta una acción sobre los datos y refresca; los errores de validación se muestran tal cual.
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action();
      await load();
      return true;
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof SuggestionError ? error.message : 'Inténtalo de nuevo. No se cambió nada.');
      await load();
      return false;
    }
  }

  async function save(input: SuggestionInput) {
    setBusy(true);
    const editing = form !== null && form !== 'new' ? form : null;
    const ok = await run(() =>
      editing
        ? updateSuggestion(db, editing.id, input)
        : addSuggestion(db, accountId, input, Math.floor(Date.now() / 1000)),
    );
    setBusy(false);
    if (ok) setForm(null);
  }

  function confirmDelete() {
    if (form === null || form === 'new') return;
    const target = form;
    Alert.alert(`¿Borrar "${target.description}"?`, 'No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          if (await run(() => deleteSuggestion(db, target.id))) setForm(null);
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.resources}>
        <View style={styles.resourcesText}>
          <Text style={styles.resourcesTitle}>Tus recursos</Text>
          <Text style={styles.resourcesLine}>{resourcesSummary}</Text>
          {account?.resources_updated_at != null && (
            <Text style={styles.meta}>Escritos {formatAgo(Math.floor(Date.now() / 1000) - account.resources_updated_at)}</Text>
          )}
        </View>
        <Pressable hitSlop={10} onPress={() => setResourcesOpen(true)}>
          <Text style={styles.link}>Editar</Text>
        </Pressable>
      </View>

      {nextUp && (
        <View style={styles.nextCard}>
          <Text style={styles.meta}>Siguiente en tu cola</Text>
          <Text style={styles.nextName}>{nextUp.suggestion.description}</Text>
          <Affordable evaluation={nextUp.evaluation} />
        </View>
      )}

      <View style={styles.toolbar}>
        <Text style={styles.count}>{pending === 1 ? '1 pendiente' : `${pending} pendientes`}</Text>
        <View style={styles.hideRow}>
          <Text style={styles.hideLabel}>Ocultar hechas</Text>
          <Switch value={hideDone} onValueChange={setHideDone} />
        </View>
      </View>

      <Pressable style={styles.add} onPress={() => setForm('new')}>
        <Text style={styles.addText}>Agregar sugerencia</Text>
      </Pressable>

      {visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{all.length === 0 ? 'Sin sugerencias' : 'Todo hecho'}</Text>
          <Text style={styles.emptyNote}>
            {all.length === 0
              ? 'Anota aquí lo que quieres mejorar después en esta cuenta.'
              : 'Desactiva "Ocultar hechas" para verlas.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <Pressable style={styles.row} onPress={() => setForm(item)}>
              <View style={styles.rowText}>
                <Text style={[styles.description, item.status === 'done' && styles.doneText]}>
                  {item.description}
                  {item.target_level !== null ? ` → nivel ${item.target_level}` : ''}
                </Text>
                {item.notes ? (
                  <Text style={styles.notes} numberOfLines={2}>
                    {item.notes}
                  </Text>
                ) : null}
                {item.status !== 'done' && <EvaluationLines item={item} evaluation={evaluations.get(item.id)} />}
                <Pressable
                  hitSlop={8}
                  style={[styles.chip, styles[item.status]]}
                  onPress={() => run(() => setSuggestionStatus(db, item.id, nextStatus(item.status)))}
                >
                  <Text style={styles.chipText}>{STATUS_LABEL[item.status]}</Text>
                </Pressable>
              </View>
              <View style={styles.arrows}>
                <Pressable
                  hitSlop={8}
                  disabled={index === 0}
                  onPress={() => run(() => moveSuggestion(db, item.id, 'up', { hideDone }))}
                >
                  <Text style={[styles.arrow, index === 0 && styles.arrowOff]}>▲</Text>
                </Pressable>
                <Pressable
                  hitSlop={8}
                  disabled={index === visible.length - 1}
                  onPress={() => run(() => moveSuggestion(db, item.id, 'down', { hideDone }))}
                >
                  <Text style={[styles.arrow, index === visible.length - 1 && styles.arrowOff]}>▼</Text>
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      )}

      <SuggestionModal
        visible={form !== null}
        suggestion={form === null || form === 'new' ? null : form}
        currentLevels={levels}
        busy={busy}
        onSave={save}
        onDelete={confirmDelete}
        onCancel={() => setForm(null)}
      />

      <ResourcesModal
        visible={resourcesOpen}
        initial={resources}
        busy={busy}
        onSave={saveResources}
        onCancel={() => setResourcesOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  count: { fontSize: 15, fontWeight: '600' },
  hideRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hideLabel: { fontSize: 14, opacity: 0.7 },
  add: { backgroundColor: colors.accentStrong, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  addText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  list: { gap: 8, paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  rowText: { flex: 1, gap: 4 },
  description: { fontSize: 16, fontWeight: '600' },
  doneText: { textDecorationLine: 'line-through', opacity: 0.55 },
  notes: { fontSize: 13, opacity: 0.7 },
  meta: { fontSize: 13, opacity: 0.7 },
  link: { fontSize: 15, color: colors.accent },
  resources: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: colors.surface },
  resourcesText: { flex: 1, gap: 2 },
  resourcesTitle: { fontSize: 13, opacity: 0.7 },
  resourcesLine: { fontSize: 15, fontWeight: '600' },
  nextCard: { padding: 14, borderRadius: 12, backgroundColor: colors.surface, gap: 2, borderWidth: 1, borderColor: colors.border },
  nextName: { fontSize: 16, fontWeight: '600' },
  enough: { fontSize: 13, fontWeight: '600', color: colors.success },
  short: { fontSize: 13, fontWeight: '600', color: colors.danger },
  chip: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 12, marginTop: 2 },
  chipText: { fontSize: 12, fontWeight: '600' },
  pending: { backgroundColor: colors.chip },
  in_progress: { backgroundColor: colors.progressBg },
  done: { backgroundColor: colors.doneBg },
  arrows: { gap: 14, alignItems: 'center' },
  arrow: { fontSize: 18, color: colors.accent },
  arrowOff: { opacity: 0.2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '600' },
  emptyNote: { fontSize: 14, opacity: 0.7, textAlign: 'center' },
});
