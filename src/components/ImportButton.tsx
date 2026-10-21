import * as Clipboard from 'expo-clipboard';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from 'react-native';

import { AliasModal } from '@/components/AliasModal';
import { ImportError, importExport } from '@/db/imports';
import { getAccountByTag } from '@/db/queries';
import { ExportParseError, parseExport, type ParsedExport } from '@/export';
import { PERMISSION_HELP, syncNow } from '@/notifications';

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

  async function save(parsed: ParsedExport, text: string, chosenAlias?: string) {
    const result = await importExport(db, parsed, text, {
      alias: chosenAlias,
      now: Math.floor(Date.now() / 1000),
    });
    const account = await getAccountByTag(db, parsed.tag);
    onImported();
    const name = account?.alias ?? parsed.tag;
    const count = result.upgradeCount;
    const sync = await syncNow(db);
    const lines = [`${name}: ${count} ${count === 1 ? 'mejora en curso' : 'mejoras en curso'}.`];
    if (sync?.permissionDenied) lines.push(PERMISSION_HELP);
    else if (sync === null || sync.failed > 0) lines.push('No se pudieron programar todos los avisos. Se reintentará al abrir la app.');
    Alert.alert(result.isNew ? 'Cuenta agregada' : 'Cuenta actualizada', lines.join('\n\n'));
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
        setPending({ parsed, text });
      }
    } catch (error) {
      Alert.alert('No se pudo importar', errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function confirmAlias(alias: string) {
    if (!pending) return;
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

      <AliasModal
        visible={pending !== null}
        title="Cuenta nueva"
        subtitle={pending?.parsed.tag}
        busy={busy}
        onConfirm={confirmAlias}
        onCancel={() => setPending(null)}
      />
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
});
