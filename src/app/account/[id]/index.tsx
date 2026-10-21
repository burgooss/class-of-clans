import { Link, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type Account, getAccount } from '@/db/queries';

export default function AccountScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    getAccount(db, Number(id)).then(setAccount);
  }, [db, id]);

  if (!account) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.alias}>{account.alias}</Text>
      <Text style={styles.tag}>{account.tag}</Text>
      <Text style={styles.note}>Fase 4: constructores y cuentas regresivas.</Text>
      <Link href={{ pathname: '/account/[id]/suggestions', params: { id } }}>Sugerencias</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 8 },
  alias: { fontSize: 22, fontWeight: '700' },
  tag: { fontSize: 13, opacity: 0.6 },
  note: { marginTop: 16, opacity: 0.7 },
});
