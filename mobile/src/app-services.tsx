/**
 * Servicios de la app (sesión, renovador y cliente de la API) creados una vez por URL base y
 * expuestos por contexto. Las pruebas inyectan un `fetch` simulado.
 */
import type { ApiClient } from '@devchrisvaz/wallet-contract';
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';

import {
  createSessionRefresher,
  createWalletApi,
  type FetchFn,
  type TokenRefresher,
} from '@/api/client';
import { Session, type SessionSnapshot } from '@/session/session';

export interface AppServices {
  baseUrl: string;
  session: Session;
  refresher: TokenRefresher;
  api: ApiClient;
}

const ServicesContext = createContext<AppServices | null>(null);

interface AppProvidersProps {
  baseUrl: string;
  fetch?: FetchFn;
  children: ReactNode;
}

function createServices(baseUrl: string, fetch: FetchFn | undefined): AppServices {
  const session = new Session();
  const options = { baseUrl, session, ...(fetch ? { fetch } : {}) };
  const refresher = createSessionRefresher(options);
  return { baseUrl, session, refresher, api: createWalletApi({ ...options, refresher }) };
}

export function AppProviders({ baseUrl, fetch, children }: AppProvidersProps) {
  const [services] = useState(() => createServices(baseUrl, fetch));
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
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
