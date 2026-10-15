/**
 * Servicios de la app (sesión, renovador, cliente de la API y caché de consultas) creados una vez
 * por URL base y expuestos por contexto. Las pruebas inyectan un `fetch` simulado.
 */
import type { ApiClient } from '@devchrisvaz/wallet-contract';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';

import {
  createSessionRefresher,
  createWalletApi,
  type FetchFn,
  type TokenRefresher,
} from '@/api/client';
import { appUserAgent } from '@/api/user-agent';
import { AccountSelectionProvider } from '@/features/accounts/selection';
import { Session, type SessionSnapshot } from '@/session/session';
import { UnlockPreferenceStore } from '@/session/unlock-preference';

export interface AppServices {
  baseUrl: string;
  session: Session;
  refresher: TokenRefresher;
  api: ApiClient;
  queryClient: QueryClient;
  /** Preferencia del desbloqueo biométrico en memoria (MOB-24). */
  unlockPreference: UnlockPreferenceStore;
}

const ServicesContext = createContext<AppServices | null>(null);

interface AppProvidersProps {
  baseUrl: string;
  fetch?: FetchFn;
  /** Servicios ya creados (pruebas que necesitan inspeccionar la sesión). */
  services?: AppServices;
  children: ReactNode;
}

interface ServiceOptions {
  /**
   * Para pruebas: sin reintentos automáticos de las lecturas y sin temporizadores de recolección
   * de la caché (con `gcTime` infinito, TanStack Query no programa ninguno).
   */
  testing?: boolean;
}

export function createServices(
  baseUrl: string,
  fetch: FetchFn | undefined,
  { testing = false }: ServiceOptions = {},
): AppServices {
  const session = new Session();
  const userAgent = appUserAgent(Constants.expoConfig?.version, Platform.OS);
  const options = { baseUrl, session, userAgent, ...(fetch ? { fetch } : {}) };
  const refresher = createSessionRefresher(options);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: testing ? false : 1,
        staleTime: 30_000,
        ...(testing ? { gcTime: Infinity } : {}),
      },
    },
  });
  const unlockPreference = new UnlockPreferenceStore();
  // Al cerrar sesión no queda en memoria ningún dato de la persona anterior, ni su preferencia de
  // desbloqueo, que la sesión ya borró del almacenamiento seguro (MOB-27).
  session.subscribe(() => {
    if (session.getSnapshot().status !== 'signedOut') return;
    queryClient.clear();
    unlockPreference.forget();
  });
  return {
    baseUrl,
    session,
    refresher,
    api: createWalletApi({ ...options, refresher }),
    queryClient,
    unlockPreference,
  };
}

export function AppProviders({ baseUrl, fetch, services: given, children }: AppProvidersProps) {
  const [services] = useState(() => given ?? createServices(baseUrl, fetch));
  return (
    <ServicesContext.Provider value={services}>
      <QueryClientProvider client={services.queryClient}>
        <AccountSelectionProvider session={services.session}>{children}</AccountSelectionProvider>
      </QueryClientProvider>
    </ServicesContext.Provider>
  );
}

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices requiere AppProviders');
  return services;
}

export function useSessionSnapshot(): SessionSnapshot {
  const { session } = useServices();
  return useSyncExternalStore(session.subscribe, session.getSnapshot);
}
