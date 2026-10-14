import type { UseQueryResult } from '@tanstack/react-query';

import { errorMessage } from './errors';

/** Estado de una lectura para una vista: cargando, con error (mensaje por `code`) o con datos. */
export type Loadable<T> =
  { status: 'pending' } | { status: 'error'; message: string } | { status: 'success'; data: T };

/**
 * Un error gana a los datos en caché: si la actualización falla no se muestran los saldos
 * anteriores como si fueran actuales (MOB-05).
 */
export function loadable<T>(
  query: Pick<UseQueryResult<T>, 'status' | 'data' | 'error'>,
): Loadable<T> {
  if (query.status === 'error') return { status: 'error', message: errorMessage(query.error) };
  if (query.status === 'pending' || query.data === undefined) return { status: 'pending' };
  return { status: 'success', data: query.data };
}
