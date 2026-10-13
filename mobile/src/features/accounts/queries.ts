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
  beneficiaries: ['beneficiaries'] as const,
};

export function required<T>(data: T | undefined): T {
  if (data === undefined) throw new Error('Respuesta vacía de la API');
  return data;
}

export function useAccountsOverview() {
  const { api } = useServices();
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: async ({ signal }) => required((await api.GET('/accounts', { signal })).data),
  });
}
