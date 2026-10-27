import { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { type CatalogItem, pickableItems } from '@/catalog';
import { Text } from '@/components/Text';
import { TextInput } from '@/components/TextInput';
import { colors } from '@/theme';

type Props = {
  visible: boolean;
  onPick: (item: CatalogItem) => void;
  onCancel: () => void;
};

// Sin acentos ni mayúsculas, para que "torre infernal" encuentre "Torre infernal" y "aerea" a "aérea".
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Buscador de elementos del juego (edificios, héroes, tropas…) para las sugerencias. */
export function ItemPickerModal({ visible, onPick, onCancel }: Props) {
  const [query, setQuery] = useState('');
  const items = useMemo(() => pickableItems(), []);

  useEffect(() => {
    if (visible) setQuery('');
  }, [visible]);

  const shown = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return items;
    return items.filter((item) => normalize(item.name).includes(q) || normalize(item.nameEn).includes(q));
  }, [items, query]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Elegir elemento</Text>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar (español o inglés)"
            autoFocus
            autoCorrect={false}
          />
          <FlatList
            data={shown}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>No hay elementos con ese nombre.</Text>}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => onPick(item)}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.name !== item.nameEn ? `${item.nameEn} · ` : ''}hasta nivel {item.maxLevel}
                </Text>
              </Pressable>
            )}
          />
          <Pressable onPress={onCancel}>
            <Text style={styles.cancel}>Cancelar</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'center', padding: 20 },
  card: { backgroundColor: colors.modal, borderRadius: 14, padding: 16, gap: 10, maxHeight: '85%' },
  title: { fontSize: 18, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 8, padding: 10, fontSize: 16 },
  list: { flexGrow: 0 },
  row: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  name: { fontSize: 16 },
  meta: { fontSize: 12, opacity: 0.6 },
  empty: { paddingVertical: 16, opacity: 0.7, textAlign: 'center' },
  cancel: { fontSize: 16, opacity: 0.7, alignSelf: 'flex-end' },
});
