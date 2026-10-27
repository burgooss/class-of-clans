import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { type CatalogItem, catalogLevels, catalogName } from '@/catalog';
import { ItemPickerModal } from '@/components/ItemPickerModal';
import { Text } from '@/components/Text';
import { TextInput } from '@/components/TextInput';
import type { Suggestion, SuggestionInput } from '@/db/suggestions';
import { STATUS_LABEL, type SuggestionStatus } from '@/domain/suggestions';
import { colors } from '@/theme';

type Props = {
  visible: boolean;
  /** Sugerencia a editar; null para crear una nueva. */
  suggestion: Suggestion | null;
  /** Nivel actual de cada elemento en el último export de la cuenta (por ID). */
  currentLevels: Map<number, number>;
  busy?: boolean;
  onSave: (input: SuggestionInput) => void;
  onDelete: () => void;
  onCancel: () => void;
};

const STATUSES: SuggestionStatus[] = ['pending', 'in_progress', 'done'];

/** Formulario para crear o editar una sugerencia de mejora (F5). */
export function SuggestionModal({ visible, suggestion, currentLevels, busy = false, onSave, onDelete, onCancel }: Props) {
  const [description, setDescription] = useState('');
  const [targetLevel, setTargetLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<SuggestionStatus>('pending');
  const [gameId, setGameId] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDescription(suggestion?.description ?? '');
    setTargetLevel(suggestion?.target_level != null ? String(suggestion.target_level) : '');
    setNotes(suggestion?.notes ?? '');
    setStatus(suggestion?.status ?? 'pending');
    setGameId(suggestion?.game_id ?? null);
    setPicking(false);
  }, [visible, suggestion]);

  // Al elegir un elemento: pone su nombre si la descripción está vacía y propone el nivel siguiente
  // al que tiene en el export (o el 1 si no lo tiene), sin pasar del máximo.
  function pick(item: CatalogItem) {
    setPicking(false);
    setGameId(item.id);
    if (description.trim() === '') setDescription(item.name);
    const current = currentLevels.get(item.id);
    const next = current === undefined ? 1 : current + 1;
    setTargetLevel(next <= item.maxLevel ? String(next) : '');
  }

  const itemLevels = gameId === null ? [] : catalogLevels(gameId);
  const itemCurrent = gameId === null ? undefined : currentLevels.get(gameId);

  const disabled = busy || description.trim() === '';
  const editing = suggestion !== null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>{editing ? 'Editar sugerencia' : 'Nueva sugerencia'}</Text>

            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder='Ej. "Torre infernal"'
              autoFocus={!editing}
              maxLength={120}
            />

            <Text style={styles.label}>Elemento del juego (opcional, para calcular el costo)</Text>
            {gameId === null ? (
              <Pressable style={styles.pick} onPress={() => setPicking(true)} disabled={busy}>
                <Text style={styles.pickText}>Elegir del catálogo</Text>
              </Pressable>
            ) : (
              <View style={styles.picked}>
                <View style={styles.pickedText}>
                  <Text style={styles.pickedName}>{catalogName(gameId)}</Text>
                  <Text style={styles.pickedMeta}>
                    {itemCurrent === undefined ? 'No está en tu export' : `Nivel actual ${itemCurrent}`} · máximo {itemLevels.length}
                  </Text>
                </View>
                <Pressable onPress={() => setPicking(true)} disabled={busy}>
                  <Text style={styles.link}>Cambiar</Text>
                </Pressable>
                <Pressable onPress={() => setGameId(null)} disabled={busy}>
                  <Text style={styles.linkDanger}>Quitar</Text>
                </Pressable>
              </View>
            )}

            <Text style={styles.label}>Nivel objetivo (opcional)</Text>
            <TextInput
              style={styles.input}
              value={targetLevel}
              onChangeText={setTargetLevel}
              placeholder="Ej. 10"
              keyboardType="number-pad"
              maxLength={3}
            />

            <Text style={styles.label}>Notas (opcional)</Text>
            <TextInput
              style={[styles.input, styles.notes]}
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />

            {editing && (
              <>
                <Text style={styles.label}>Estado</Text>
                <View style={styles.statusRow}>
                  {STATUSES.map((s) => (
                    <Pressable
                      key={s}
                      style={[styles.statusChip, status === s && styles.statusChipOn]}
                      onPress={() => setStatus(s)}
                    >
                      <Text style={[styles.statusText, status === s && styles.statusTextOn]}>{STATUS_LABEL[s]}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            <View style={styles.actions}>
              {editing ? (
                <Pressable onPress={onDelete} disabled={busy}>
                  <Text style={styles.delete}>Borrar</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <View style={styles.actionsRight}>
                <Pressable onPress={onCancel} disabled={busy}>
                  <Text style={styles.cancel}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={() => onSave({ description, targetLevel, notes, status: editing ? status : undefined, gameId })}
                  disabled={disabled}
                >
                  <Text style={[styles.confirm, disabled && styles.disabled]}>Guardar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
      <ItemPickerModal visible={picking} onPick={pick} onCancel={() => setPicking(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: colors.modal, borderRadius: 14, padding: 20, gap: 8 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  label: { fontSize: 13, opacity: 0.7, marginTop: 4 },
  input: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, padding: 10, fontSize: 16 },
  notes: { minHeight: 80 },
  pick: { borderWidth: 1, borderColor: colors.accent, borderRadius: 8, padding: 10, alignItems: 'center' },
  pickText: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  picked: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderRadius: 8, padding: 10 },
  pickedText: { flex: 1 },
  pickedName: { fontSize: 15, fontWeight: '600' },
  pickedMeta: { fontSize: 12, opacity: 0.7 },
  link: { fontSize: 14, color: colors.accent },
  linkDanger: { fontSize: 14, color: colors.danger },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusChip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.chip },
  statusChipOn: { backgroundColor: colors.accentStrong },
  statusText: { fontSize: 14 },
  statusTextOn: { color: '#fff', fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  actionsRight: { flexDirection: 'row', gap: 24 },
  cancel: { fontSize: 16, opacity: 0.7 },
  confirm: { fontSize: 16, fontWeight: '700', color: colors.accent },
  delete: { fontSize: 16, color: colors.danger },
  disabled: { opacity: 0.5 },
});
