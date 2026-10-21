import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function icon(name: IconName) {
  // El color llega como ColorValue (puede ser null); Ionicons no acepta null.
  const TabIcon = ({ color, size }: { color: unknown; size: number }) => (
    <Ionicons name={name} color={(color ?? undefined) as string | undefined} size={size} />
  );
  return TabIcon;
}

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'General', tabBarIcon: icon('hammer-outline') }} />
      <Tabs.Screen name="layouts" options={{ title: 'Bases', tabBarIcon: icon('grid-outline') }} />
      <Tabs.Screen name="armies" options={{ title: 'Ejércitos', tabBarIcon: icon('shield-outline') }} />
      <Tabs.Screen name="settings" options={{ title: 'Ajustes', tabBarIcon: icon('settings-outline') }} />
    </Tabs>
  );
}
