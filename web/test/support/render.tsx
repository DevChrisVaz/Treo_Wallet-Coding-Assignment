import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';

/** QueryClient de pruebas: sin reintentos ni caché entre pruebas. */
export function testQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: 0 },
    },
  });
}

/** Renderiza con un QueryClientProvider propio y lo devuelve para inspeccionar la caché. */
export function renderWithClient(
  ui: ReactElement,
  { client = testQueryClient(), ...options }: RenderOptions & { client?: QueryClient } = {},
) {
  return {
    client,
    ...render(ui, {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
      ...options,
    }),
  };
}
