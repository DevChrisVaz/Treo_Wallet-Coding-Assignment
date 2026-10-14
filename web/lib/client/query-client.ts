import { ProblemError } from '@devchrisvaz/wallet-contract';
import { QueryCache, QueryClient } from '@tanstack/react-query';

export interface QueryClientOptions {
  /** Una lectura respondió 401: la sesión ya no existe (WEB-22). */
  onUnauthenticated: () => void;
}

const MAX_READ_RETRIES = 2;

/**
 * Cliente de TanStack Query (D11 de web-app): las lecturas reintentan solo fallos de red o 5xx; las
 * mutaciones nunca se reintentan solas (la transferencia se reintenta a mano, con la misma llave).
 */
export function createQueryClient({ onUnauthenticated }: QueryClientOptions): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError(error) {
        if (error instanceof ProblemError && error.status === 401) onUnauthenticated();
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: (failureCount, error) =>
          failureCount < MAX_READ_RETRIES && !(error instanceof ProblemError && error.status < 500),
      },
      mutations: { retry: 0 },
    },
  });
}
