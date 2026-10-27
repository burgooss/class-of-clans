import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import { Text } from '@/components/Text';
import { BackupError, parseBackup, summarize } from '@/backup/format';
import { pickBackupText, shareBackupFile } from '@/backup/files';
import { createBackup, restoreBackup } from '@/db/backup';
import { SCHEMA_VERSION } from '@/db/migrations';
import { PERMISSION_HELP, syncNow } from '@/notifications';
import { colors } from '@/theme';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [busy, setBusy] = useState(false);

  async function exportData() {
    setBusy(true);
    try {
      const now = Math.floor(Date.now() / 1000);
      const backup = await createBackup(db, now);
      const shared = await shareBackupFile(JSON.stringify(backup), now);
      if (!shared) Alert.alert('No se pudo compartir', 'Este teléfono no permite compartir archivos desde la app.');
    } catch {
      Alert.alert('No se pudo exportar', 'Inténtalo de nuevo. No se cambió nada.');
    } finally {
      setBusy(false);
    }
  }

  async function importData() {
    setBusy(true);
    try {
      const text = await pickBackupText();
      if (text === null) return;
      const backup = parseBackup(text, { schemaVersion: SCHEMA_VERSION });
      const counts = summarize(backup);

      const summary = [
        plural(counts.accounts, 'cuenta', 'cuentas'),
        plural(counts.suggestions, 'sugerencia', 'sugerencias'),
        plural(counts.layouts, 'base', 'bases'),
        plural(counts.armies, 'ejército', 'ejércitos'),
      ].join(', ');

      Alert.alert(
        '¿Reemplazar todos los datos?',
        `Respaldo del ${new Date(backup.exportedAt * 1000).toLocaleString()}: ${summary}.\n\nSe borrarán TODOS los datos actuales de la app y se sustituirán por los del archivo. No se puede deshacer.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Reemplazar', style: 'destructive', onPress: () => restore(backup) },
        ],
      );
    } catch (error) {
      Alert.alert(
        'No se pudo importar',
        error instanceof BackupError ? error.message : 'No se pudo leer el archivo. No se cambió nada.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function restore(backup: ReturnType<typeof parseBackup>) {
    setBusy(true);
    try {
      await restoreBackup(db, backup);
      const sync = await syncNow(db);
      const lines = ['Datos restaurados.'];
      if (sync?.permissionDenied) lines.push(PERMISSION_HELP);
      Alert.alert('Listo', lines.join('\n\n'));
    } catch {
      Alert.alert('No se pudo restaurar', 'Ocurrió un error y se conservaron los datos que tenías.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.section}>Respaldo</Text>
      <Text style={styles.note}>
        Guarda todos tus datos (cuentas, exports, sugerencias, bases y ejércitos) en un archivo para pasarlos a otro teléfono
        o recuperarlos después de reinstalar. El archivo incluye los tags de tus cuentas: compártelo solo con quien confíes.
      </Text>

      <Pressable style={[styles.button, busy && styles.disabled]} onPress={exportData} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Exportar datos</Text>}
      </Pressable>
      <Pressable style={[styles.buttonAlt, busy && styles.disabled]} onPress={importData} disabled={busy}>
        <Text style={styles.buttonAltText}>Importar datos</Text>
      </Pressable>
      <Text style={styles.note}>Importar reemplaza todo lo que hay ahora en la app.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  section: { fontSize: 20, fontWeight: '700' },
  note: { fontSize: 13, opacity: 0.7 },
  button: { backgroundColor: colors.accentStrong, paddingVertical: 12, borderRadius: 10, alignItems: 'center', minHeight: 46, justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  buttonAlt: { paddingVertical: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.accent },
  buttonAltText: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
