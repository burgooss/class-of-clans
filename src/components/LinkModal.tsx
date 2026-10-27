import * as Clipboard from 'expo-clipboard';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { TextInput } from '@/components/TextInput';
import type { Account } from '@/db/queries';
import type { LinkInput, SavedLink } from '@/db/links';
import { CATEGORY_LABEL, type CollectionConfig, type LinkCategory } from '@/domain/links';
import { colors } from '@/theme';

type Props = {
  visible: boolean;
  config: CollectionConfig;
  /** Elemento a editar; null para crear uno nuevo. */
  link: SavedLink | null;
  accounts: Account[];
  /** Categoría con la que empieza un elemento nuevo. */
  defaultCategory: LinkCategory;
  busy?: boolean;
  onSave: (input: LinkInput) => void;
  onDelete: () => void;
  onCancel: () => void;
};

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

/** Formulario para guardar o editar una base o un ejército (F6, F7). */
export function LinkModal({ visible, config, link, accounts, defaultCategory, busy = false, onSave, onDelete, onCancel }: Props) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [townHall, setTownHall] = useState('');
  const [category, setCategory] = useState<LinkCategory>(defaultCategory);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!visible) return;
    setName(link?.name ?? '');
    setUrl(link?.url ?? '');
    setTownHall(link?.town_hall != null ? String(link.town_hall) : '');
    setCategory(link?.category ?? defaultCategory);
    setAccountId(link?.account_id ?? null);
    setNotes(link?.notes ?? '');
  }, [visible, link, defaultCategory]);

  async function paste() {
    const text = await Clipboard.getStringAsync();
    if (text.trim()) setUrl(text.trim());
  }

  const editing = link !== null;
  const disabled = busy || name.trim() === '' || url.trim() === '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>{editing ? `Editar ${config.singular}` : `Nueva ${config.singular}`}</Text>

            <Text style={styles.label}>Nombre</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} maxLength={80} autoFocus={!editing} />

            <Text style={styles.label}>Link del juego</Text>
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://..."
            />
            <Pressable onPress={paste} disabled={busy}>
              <Text style={styles.paste}>Pegar del portapapeles</Text>
            </Pressable>

            <Text style={styles.label}>Ayuntamiento (opcional)</Text>
            <TextInput
              style={styles.input}
              value={townHall}
              onChangeText={setTownHall}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="Ej. 14"
            />

            <Text style={styles.label}>{config.categoryTitle}</Text>
            <View style={styles.chips}>
              {config.categories.map((c) => (
                <Chip key={c} label={CATEGORY_LABEL[c]} on={category === c} onPress={() => setCategory(c)} />
              ))}
            </View>

            <Text style={styles.label}>Cuenta</Text>
            <View style={styles.chips}>
              <Chip label="Todas" on={accountId === null} onPress={() => setAccountId(null)} />
              {accounts.map((a) => (
                <Chip key={a.id} label={a.alias} on={accountId === a.id} onPress={() => setAccountId(a.id)} />
              ))}
            </View>

            <Text style={styles.label}>Notas (opcional)</Text>
            <TextInput
              style={[styles.input, styles.notes]}
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />

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
                  onPress={() => onSave({ name, url, townHall, category, accountId, notes })}
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
  notes: { minHeight: 70 },
  paste: { fontSize: 14, color: colors.accent },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, backgroundColor: colors.chip },
  chipOn: { backgroundColor: colors.accentStrong },
  chipText: { fontSize: 14 },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  actionsRight: { flexDirection: 'row', gap: 24 },
  cancel: { fontSize: 16, opacity: 0.7 },
  confirm: { fontSize: 16, fontWeight: '700', color: colors.accent },
  delete: { fontSize: 16, color: colors.danger },
  disabled: { opacity: 0.5 },
});
