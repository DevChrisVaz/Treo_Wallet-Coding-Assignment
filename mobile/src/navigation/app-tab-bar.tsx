import type { NavDestination } from '@devchrisvaz/wallet-design-tokens';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { TabBar } from '@/components/ui';

/** Pestañas de la app (MOB-18); la web agrega Beneficiarios (WEB-27). */
export const TAB_ITEMS = [
  'home',
  'movements',
  'transfer',
] as const satisfies readonly NavDestination[];

/**
 * Barra de pestañas de expo-router con el TabBar del kit. Inicio y Movimientos son pestañas;
 * Transferir abre el flujo, que es una pantalla de la pila fuera de las pestañas y por eso se ve a
 * pantalla completa, sin la barra.
 */
export function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const current: NavDestination =
    state.routes[state.index]?.name === 'movements' ? 'movements' : 'home';
  return (
    <TabBar
      items={TAB_ITEMS}
      current={current}
      onSelect={(key) => {
        if (key === 'transfer') router.push('/transfer');
        else if (key === 'movements') navigation.navigate('movements');
        else navigation.navigate('index');
      }}
    />
  );
}
