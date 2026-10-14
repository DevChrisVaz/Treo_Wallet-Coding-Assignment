import { useState } from 'react';

/**
 * Refresco iniciado por la persona (deslizar hacia abajo): mantiene el indicador visible durante
 * toda la consulta, a diferencia de `isRefetching`, que también cuenta refrescos automáticos.
 */
export function useRefreshByUser(refetch: () => Promise<unknown>) {
  const [refreshing, setRefreshing] = useState(false);
  return {
    refreshing,
    async onRefresh() {
      setRefreshing(true);
      try {
        await refetch();
      } finally {
        setRefreshing(false);
      }
    },
  };
}
