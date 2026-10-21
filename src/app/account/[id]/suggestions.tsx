import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { SuggestionModal } from '@/components/SuggestionModal';
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
import { nextStatus, STATUS_LABEL } from '@/domain/suggestions';

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

  const load = useCallback(async () => {
    setAll(await getSuggestions(db, accountId));
  }, [db, accountId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const visible = useMemo(() => (hideDone ? all.filter((s) => s.status !== 'done') : all), [all, hideDone]);
  const pending = all.filter((s) => s.status !== 'done').length;

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
        busy={busy}
        onSave={save}
        onDelete={confirmDelete}
        onCancel={() => setForm(null)}
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
  add: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  addText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  list: { gap: 8, paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  rowText: { flex: 1, gap: 4 },
  description: { fontSize: 16, fontWeight: '600' },
  doneText: { textDecorationLine: 'line-through', opacity: 0.55 },
  notes: { fontSize: 13, opacity: 0.7 },
  chip: { alignSelf: 'flex-start', paddingVertical: 3, paddingHorizontal: 10, borderRadius: 12, marginTop: 2 },
  chipText: { fontSize: 12, fontWeight: '600' },
  pending: { backgroundColor: 'rgba(128,128,128,0.25)' },
  in_progress: { backgroundColor: '#fde68a' },
  done: { backgroundColor: '#bbf7d0' },
  arrows: { gap: 14, alignItems: 'center' },
  arrow: { fontSize: 18, color: '#2563eb' },
  arrowOff: { opacity: 0.2 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '600' },
  emptyNote: { fontSize: 14, opacity: 0.7, textAlign: 'center' },
});
