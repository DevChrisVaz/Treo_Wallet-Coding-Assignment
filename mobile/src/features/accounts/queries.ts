/**
 * Lecturas con TanStack Query (diseño, decisión 4): estados de carga, error y refresco uniformes.
 * El cliente lanza `ProblemError` o `NetworkError` en cualquier fallo, así que `data` existe en
 * cada respuesta exitosa.
 */
import { useQuery } from '@tanstack/react-query';

import { useServices } from '@/app-services';

export const queryKeys = {
  accounts: ['accounts'] as const,
  movements: (accountId: string) => ['accounts', accountId, 'movements'] as const,
  latestMovements: (accountId: string) => ['accounts', accountId, 'movements', 'latest'] as const,
  beneficiaries: ['beneficiaries'] as const,
  me: ['me'] as const,
};

export function required<T>(data: T | undefined): T {
  if (data === undefined) throw new Error('Respuesta vacía de la API');
  return data;
}

/** Los móviles muestran solo los últimos 20, sin filtros ni paginación (MOB-06). */
export const MOVEMENTS_LIMIT = 20;

export function useRecentMovements(accountId: string | undefined) {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.movements(accountId ?? ''),
    queryFn: async ({ signal }) => {
      const { data } = await api.GET('/accounts/{accountId}/movements', {
        params: { path: { accountId: accountId ?? '' }, query: { limit: MOVEMENTS_LIMIT } },
        signal,
      });
      return required(data).items.slice(0, MOVEMENTS_LIMIT);
    },
    enabled: accountId !== undefined,
  });
}

/** Lo que muestra Inicio por cuenta (MOB-19; D9: el mismo endpoint con `limit=5`). */
export const LATEST_MOVEMENTS_LIMIT = 5;

export function useLatestMovements(accountId: string | undefined) {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.latestMovements(accountId ?? ''),
    queryFn: async ({ signal }) => {
      const { data } = await api.GET('/accounts/{accountId}/movements', {
        params: { path: { accountId: accountId ?? '' }, query: { limit: LATEST_MOVEMENTS_LIMIT } },
        signal,
      });
      return required(data).items.slice(0, LATEST_MOVEMENTS_LIMIT);
    },
    enabled: accountId !== undefined,
  });
}

export function useBeneficiaries() {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.beneficiaries,
    queryFn: async ({ signal }) => required((await api.GET('/beneficiaries', { signal })).data),
  });
}

export function useAccountsOverview() {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: async ({ signal }) => required((await api.GET('/accounts', { signal })).data),
  });
}

/** Usuario de la sesión para el saludo y el menú de la cuenta (MOB-18, MOB-19). */
export function useCurrentUser() {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: async ({ signal }) => required((await api.GET('/me', { signal })).data),
    staleTime: Infinity,
  });
}
