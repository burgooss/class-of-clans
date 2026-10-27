import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { TextInput } from '@/components/TextInput';
import type { Suggestion, SuggestionInput } from '@/db/suggestions';
import { STATUS_LABEL, type SuggestionStatus } from '@/domain/suggestions';
import { colors } from '@/theme';

type Props = {
  visible: boolean;
  /** Sugerencia a editar; null para crear una nueva. */
  suggestion: Suggestion | null;
  busy?: boolean;
  onSave: (input: SuggestionInput) => void;
  onDelete: () => void;
  onCancel: () => void;
};

const STATUSES: SuggestionStatus[] = ['pending', 'in_progress', 'done'];

/** Formulario para crear o editar una sugerencia de mejora (F5). */
export function SuggestionModal({ visible, suggestion, busy = false, onSave, onDelete, onCancel }: Props) {
  const [description, setDescription] = useState('');
  const [targetLevel, setTargetLevel] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<SuggestionStatus>('pending');

  useEffect(() => {
    if (!visible) return;
    setDescription(suggestion?.description ?? '');
    setTargetLevel(suggestion?.target_level != null ? String(suggestion.target_level) : '');
    setNotes(suggestion?.notes ?? '');
    setStatus(suggestion?.status ?? 'pending');
  }, [visible, suggestion]);

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
                  onPress={() => onSave({ description, targetLevel, notes, status: editing ? status : undefined })}
                  disabled={disabled}
                >
                  <Text style={[styles.confirm, disabled && styles.disabled]}>Guardar</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
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
