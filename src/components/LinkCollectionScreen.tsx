import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { LinkModal } from '@/components/LinkModal';
import { addLink, deleteLink, getLinks, LinkError, type LinkInput, type SavedLink, updateLink } from '@/db/links';
import { type Account, getAccounts } from '@/db/queries';
import {
  CATEGORY_LABEL,
  type Collection,
  COLLECTIONS,
  filterLinks,
  type LinkCategory,
  townHallsIn,
} from '@/domain/links';

// null = cerrado, 'new' = creando, SavedLink = editando.
type FormState = null | 'new' | SavedLink;

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

/** Lista con filtros y alta/edición para bases (F6) o ejércitos (F7). Tocar un elemento abre su link. */
export function LinkCollectionScreen({ collection }: { collection: Collection }) {
  const config = COLLECTIONS[collection];
  const db = useSQLiteContext();
  const [items, setItems] = useState<SavedLink[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [townHall, setTownHall] = useState<number | null>(null);
  const [category, setCategory] = useState<LinkCategory | null>(null);
  const [form, setForm] = useState<FormState>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [links, accountRows] = await Promise.all([getLinks(db, collection), getAccounts(db)]);
    setItems(links);
    setAccounts(accountRows);
  }, [db, collection]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const aliasById = useMemo(() => new Map(accounts.map((a) => [a.id, a.alias])), [accounts]);
  const townHalls = useMemo(() => townHallsIn(items), [items]);
  // Si el ayuntamiento filtrado ya no existe (se editó o borró), se ignora el filtro.
  const activeTownHall = townHall !== null && townHalls.includes(townHall) ? townHall : null;
  const visible = useMemo(
    () => filterLinks(items, { townHall: activeTownHall, category }),
    [items, activeTownHall, category],
  );

  async function open(item: SavedLink) {
    try {
      await Linking.openURL(item.url);
    } catch {
      Alert.alert('No se pudo abrir el link', 'Comprueba que el link sea correcto y que el juego esté instalado.');
    }
  }

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action();
      await load();
      return true;
    } catch (error) {
      Alert.alert('No se pudo guardar', error instanceof LinkError ? error.message : 'Inténtalo de nuevo. No se cambió nada.');
      await load();
      return false;
    }
  }

  async function save(input: LinkInput) {
    setBusy(true);
    const editing = form !== null && form !== 'new' ? form : null;
    const ok = await run(() =>
      editing
        ? updateLink(db, collection, editing.id, input)
        : addLink(db, collection, input, Math.floor(Date.now() / 1000)),
    );
    setBusy(false);
    if (ok) setForm(null);
  }

  function confirmDelete() {
    if (form === null || form === 'new') return;
    const target = form;
    Alert.alert(`¿Borrar "${target.name}"?`, 'No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          if (await run(() => deleteLink(db, collection, target.id))) setForm(null);
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.add} onPress={() => setForm('new')}>
        <Text style={styles.addText}>Agregar {config.singular}</Text>
      </Pressable>

      {items.length > 0 && (
        <View style={styles.filters}>
          {townHalls.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <Chip label="Todos los TH" on={activeTownHall === null} onPress={() => setTownHall(null)} />
              {townHalls.map((th) => (
                <Chip key={th} label={`TH${th}`} on={activeTownHall === th} onPress={() => setTownHall(th)} />
              ))}
            </ScrollView>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip label="Todos" on={category === null} onPress={() => setCategory(null)} />
            {config.categories.map((c) => (
              <Chip key={c} label={CATEGORY_LABEL[c]} on={category === c} onPress={() => setCategory(c)} />
            ))}
          </ScrollView>
        </View>
      )}

      {visible.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{items.length === 0 ? `Sin ${config.title.toLowerCase()}` : 'Nada con esos filtros'}</Text>
          <Text style={styles.emptyNote}>
            {items.length === 0
              ? `Guarda el link de una ${config.singular} para abrirla después en el juego.`
              : 'Cambia o quita los filtros para ver más.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(l) => String(l.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => {
            const parts = [
              item.town_hall !== null ? `TH${item.town_hall}` : null,
              CATEGORY_LABEL[item.category],
              item.account_id !== null ? (aliasById.get(item.account_id) ?? null) : 'Todas las cuentas',
            ].filter(Boolean);
            return (
              <Pressable style={styles.row} onPress={() => open(item)}>
                <View style={styles.rowText}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>{parts.join(' · ')}</Text>
                  {item.notes ? (
                    <Text style={styles.notes} numberOfLines={2}>
                      {item.notes}
                    </Text>
                  ) : null}
                </View>
                <Pressable hitSlop={10} onPress={() => setForm(item)}>
                  <Text style={styles.edit}>Editar</Text>
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}

      <LinkModal
        visible={form !== null}
        config={config}
        link={form === null || form === 'new' ? null : form}
        accounts={accounts}
        defaultCategory={category ?? config.categories[0]}
        busy={busy}
        onSave={save}
        onDelete={confirmDelete}
        onCancel={() => setForm(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  add: { backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  addText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  filters: { gap: 8 },
  chipRow: { gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(128,128,128,0.15)' },
  chipOn: { backgroundColor: '#2563eb' },
  chipText: { fontSize: 14 },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  list: { gap: 8, paddingBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  rowText: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '600' },
  meta: { fontSize: 13, opacity: 0.7 },
  notes: { fontSize: 13, opacity: 0.7, marginTop: 2 },
  edit: { fontSize: 14, color: '#2563eb' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyTitle: { fontSize: 20, fontWeight: '600' },
  emptyNote: { fontSize: 14, opacity: 0.7, textAlign: 'center' },
});
