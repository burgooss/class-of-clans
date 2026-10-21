import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Nombre del archivo de respaldo: clash-builders-AAAA-MM-DD.json (fecha UTC). */
export function backupFileName(now: number): string {
  return `clash-builders-${new Date(now * 1000).toISOString().slice(0, 10)}.json`;
}

/**
 * Guarda el respaldo en la caché y abre el menú de compartir del sistema.
 * @returns false si el teléfono no permite compartir archivos.
 */
export async function shareBackupFile(text: string, now: number): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;

  const file = new File(Paths.cache, backupFileName(now));
  file.create({ overwrite: true });
  await file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Respaldo de Clash Builders' });
  return true;
}

/**
 * Deja elegir un archivo y devuelve su texto, o null si el usuario canceló.
 * Se acepta cualquier tipo: según de dónde venga, Android no siempre lo marca como JSON;
 * el contenido se valida después.
 */
export async function pickBackupText(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled || result.assets.length === 0) return null;
  return new File(result.assets[0].uri).text();
}
