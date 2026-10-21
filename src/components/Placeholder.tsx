import { StyleSheet, Text, View } from 'react-native';

type Props = { title: string; note: string };

export function Placeholder({ title, note }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>{note}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 8 },
  title: { fontSize: 20, fontWeight: '600' },
  note: { fontSize: 14, opacity: 0.7, textAlign: 'center' },
});
