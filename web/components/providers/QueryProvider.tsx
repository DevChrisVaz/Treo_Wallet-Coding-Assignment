'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from '@/lib/client/query-client';
import { loginPath } from '@/lib/navigation';

/**
 * Proveedor de TanStack Query. Si una lectura responde 401 (la sesión expiró o se revocó), se hace
 * una navegación completa al inicio de sesión: así también se descarta la caché del navegador.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() =>
    createQueryClient({
      onUnauthenticated() {
        const here = `${window.location.pathname}${window.location.search}`;
        window.location.assign(loginPath(here, 'expired'));
      },
    }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
