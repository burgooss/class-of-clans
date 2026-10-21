import { Link } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Placeholder } from '@/components/Placeholder';
import { type Account, getAccounts } from '@/db/queries';

export default function OverviewScreen() {
  const db = useSQLiteContext();
  const [accounts, setAccounts] = useState<Account[]>([]);

  useFocusEffect(
    useCallback(() => {
      getAccounts(db).then(setAccounts);
    }, [db]),
  );

  if (accounts.length === 0) {
    return (
      <Placeholder
        title="Sin cuentas"
        note='Aquí aparecerán tus cuentas. El botón "Pegar export" llega en la Fase 4.'
      />
    );
  }

  return (
    <FlatList
      data={accounts}
      keyExtractor={(a) => String(a.id)}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Link href={{ pathname: '/account/[id]', params: { id: item.id } }} asChild>
          <Pressable style={styles.row}>
            <View>
              <Text style={styles.alias}>{item.alias}</Text>
              <Text style={styles.tag}>{item.tag}</Text>
            </View>
          </Pressable>
        </Link>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 8 },
  row: { padding: 16, borderRadius: 12, backgroundColor: 'rgba(128,128,128,0.12)' },
  alias: { fontSize: 16, fontWeight: '600' },
  tag: { fontSize: 12, opacity: 0.6 },
});
