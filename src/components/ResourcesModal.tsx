import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/Text';
import { TextInput } from '@/components/TextInput';
import { parseAmount, type Resources } from '@/domain/resources';
import { colors } from '@/theme';

type Props = {
  visible: boolean;
  /** Recursos que ya estaban registrados. */
  initial: Resources;
  busy?: boolean;
  onSave: (resources: Resources) => void;
  onCancel: () => void;
};

const FIELDS: { key: keyof Resources; label: string }[] = [
  { key: 'gold', label: 'Oro' },
  { key: 'elixir', label: 'Elixir' },
  { key: 'dark', label: 'Elixir oscuro' },
];

const asText = (value: number | null) => (value === null ? '' : String(value));

/** Formulario para escribir los recursos de una cuenta. El juego no los incluye en el export. */
export function ResourcesModal({ visible, initial, busy = false, onSave, onCancel }: Props) {
  const [text, setText] = useState({ gold: '', elixir: '', dark: '' });

  useEffect(() => {
    if (visible) setText({ gold: asText(initial.gold), elixir: asText(initial.elixir), dark: asText(initial.dark) });
  }, [visible, initial]);

  const parsed = FIELDS.map(({ key }) => parseAmount(text[key]));
  const invalid = parsed.some((p) => !p.ok);

  function save() {
    if (invalid) return;
    const [gold, elixir, dark] = parsed.map((p) => (p.ok ? p.value : null));
    onSave({ gold, elixir, dark });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Tus recursos</Text>
            <Text style={styles.hint}>
              El juego no incluye los recursos en el export, así que los escribes tú. Puedes usar 1.5M, 850k o 1,234,567. Déjalo
              vacío si no quieres registrarlo.
            </Text>

            {FIELDS.map(({ key, label }, index) => (
              <View key={key} style={styles.field}>
                <Text style={styles.label}>{label}</Text>
                <TextInput
                  style={[styles.input, !parsed[index].ok && styles.inputError]}
                  value={text[key]}
                  onChangeText={(value) => setText((t) => ({ ...t, [key]: value }))}
                  keyboardType="default"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Sin registrar"
                  autoFocus={index === 0}
                />
                {!parsed[index].ok && <Text style={styles.error}>No es una cantidad válida.</Text>}
              </View>
            ))}

            <View style={styles.actions}>
              <Pressable onPress={onCancel} disabled={busy}>
                <Text style={styles.cancel}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={save} disabled={busy || invalid}>
                <Text style={[styles.confirm, (busy || invalid) && styles.disabled]}>Guardar</Text>
              </Pressable>
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
  title: { fontSize: 18, fontWeight: '700' },
  hint: { fontSize: 13, opacity: 0.7 },
  field: { gap: 4, marginTop: 4 },
  label: { fontSize: 13, opacity: 0.7 },
  input: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, padding: 10, fontSize: 16 },
  inputError: { borderColor: colors.danger },
  error: { fontSize: 12, color: colors.danger },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, marginTop: 12 },
  cancel: { fontSize: 16, opacity: 0.7 },
  confirm: { fontSize: 16, fontWeight: '700', color: colors.accent },
  disabled: { opacity: 0.5 },
});
