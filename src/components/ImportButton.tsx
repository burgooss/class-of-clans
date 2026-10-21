import * as Clipboard from 'expo-clipboard';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ImportError, importExport } from '@/db/imports';
import { getAccountByTag } from '@/db/queries';
import { ExportParseError, parseExport, type ParsedExport } from '@/export';

type Props = { onImported: () => void };

type Pending = { parsed: ParsedExport; text: string };

function errorMessage(error: unknown): string {
  if (error instanceof ExportParseError || error instanceof ImportError) return error.message;
  return 'No se pudo importar el export. No se cambió nada.';
}

/** F1: lee el portapapeles, valida el export y lo guarda. Pide alias si la cuenta es nueva. */
export function ImportButton({ onImported }: Props) {
  const db = useSQLiteContext();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [alias, setAlias] = useState('');

  async function save(parsed: ParsedExport, text: string, chosenAlias?: string) {
    const result = await importExport(db, parsed, text, {
      alias: chosenAlias,
      now: Math.floor(Date.now() / 1000),
    });
    const account = await getAccountByTag(db, parsed.tag);
    onImported();
    const name = account?.alias ?? parsed.tag;
    const count = result.upgradeCount;
    Alert.alert(
      result.isNew ? 'Cuenta agregada' : 'Cuenta actualizada',
      `${name}: ${count} ${count === 1 ? 'mejora en curso' : 'mejoras en curso'}.`,
    );
  }

  async function start() {
    setBusy(true);
    try {
      const text = await Clipboard.getStringAsync();
      const parsed = parseExport(text);
      const existing = await getAccountByTag(db, parsed.tag);
      if (existing) {
        await save(parsed, text);
      } else {
        setAlias('');
        setPending({ parsed, text });
      }
    } catch (error) {
      Alert.alert('No se pudo importar', errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function confirmAlias() {
    if (!pending || alias.trim() === '') return;
    const { parsed, text } = pending;
    setBusy(true);
    try {
      await save(parsed, text, alias);
      setPending(null);
    } catch (error) {
      setPending(null);
      Alert.alert('No se pudo importar', errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Pressable style={[styles.button, busy && styles.disabled]} onPress={start} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Pegar export</Text>}
      </Pressable>

      <Modal visible={pending !== null} transparent animationType="fade" onRequestClose={() => setPending(null)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.title}>Cuenta nueva</Text>
            <Text style={styles.subtitle}>{pending?.parsed.tag}</Text>
            <TextInput
              style={styles.input}
              value={alias}
              onChangeText={setAlias}
              placeholder='Alias (ej. "Principal", "Granja TH12")'
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={confirmAlias}
            />
            <View style={styles.actions}>
              <Pressable onPress={() => setPending(null)} disabled={busy}>
                <Text style={styles.cancel}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={confirmAlias} disabled={busy || alias.trim() === ''}>
                <Text style={[styles.confirm, (busy || alias.trim() === '') && styles.disabled]}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 20, gap: 12 },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { fontSize: 13, opacity: 0.6 },
  input: { borderWidth: 1, borderColor: 'rgba(128,128,128,0.5)', borderRadius: 8, padding: 10, fontSize: 16 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24, marginTop: 4 },
  cancel: { fontSize: 16, opacity: 0.7 },
  confirm: { fontSize: 16, fontWeight: '700', color: '#2563eb' },
});
