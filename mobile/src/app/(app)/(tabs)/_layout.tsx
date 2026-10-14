import { Tabs } from 'expo-router/js-tabs';

import { AppTabBar } from '@/navigation/app-tab-bar';

/** Pestañas con sesión (MOB-18): Inicio y Movimientos. El flujo de transferencia vive en `(app)/transfer`. */
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <AppTabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="movements" />
    </Tabs>
  );
}
