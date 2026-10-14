import { createElement, type ReactNode } from 'react';

import { useServices } from '@/app-services';
import { UnlockSwitch } from '@/features/unlock/unlock-switch';
import { logout } from '@/session/logout';

import { useCurrentUser } from './queries';

/**
 * Encabezado de las pestañas: el usuario de `GET /me`, el cierre de sesión del menú (MOB-04, MOB-18)
 * y, en el mismo menú, el interruptor del desbloqueo biométrico (MOB-24, R46). Si `GET /me` falla,
 * el encabezado saluda sin nombre y `retryUser` lo vuelve a pedir (Reintentar o deslizar en Inicio).
 */
export function useAccountHeader(): {
  user: { name: string; email: string };
  onLogout: () => void;
  menuExtra: ReactNode;
  retryUser: () => Promise<unknown>;
} {
  const { session, api } = useServices();
  const me = useCurrentUser();
  return {
    user: { name: me.data?.fullName ?? '', email: me.data?.email ?? '' },
    onLogout: () => void logout(session, api),
    menuExtra: createElement(UnlockSwitch),
    retryUser: () => (me.isError ? me.refetch() : Promise.resolve()),
  };
}
