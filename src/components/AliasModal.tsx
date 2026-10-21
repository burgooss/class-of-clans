import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  initialValue?: string;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: (alias: string) => void;
  onCancel: () => void;
};

/** Cuadro para escribir el alias de una cuenta (alta y renombrado). */
export function AliasModal({
  visible,
  title,
  subtitle,
  initialValue = '',
  confirmLabel = 'Guardar',
  busy = false,
  onConfirm,
  onCancel,
}: Props) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const disabled = busy || value.trim() === '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            placeholder='Alias (ej. "Principal", "Granja TH12")'
            autoFocus
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={() => !disabled && onConfirm(value)}
          />
          <View style={styles.actions}>
            <Pressable onPress={onCancel} disabled={busy}>
              <Text style={styles.cancel}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={() => onConfirm(value)} disabled={disabled}>
              <Text style={[styles.confirm, disabled && styles.disabled]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 20, gap: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13, opacity: 0.6 },
  input: { borderWidth: 1, borderColor: 'rgba(128,128,128,0.5)', borderRadius: 8, padding: 10, fontSize: 16 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, marginTop: 4 },
  cancel: { fontSize: 16, opacity: 0.7 },
  confirm: { fontSize: 16, fontWeight: '700', color: '#2563eb' },
  disabled: { opacity: 0.5 },
});
