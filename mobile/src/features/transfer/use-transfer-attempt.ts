import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { useServices } from '@/app-services';
import { queryKeys } from '@/features/accounts/queries';

import { netInfoConnectivity } from './connectivity';
import { TransferAttempt, type AttemptState } from './transfer-attempt';
import { createTransferTransport } from './transport';

/** Un intento de transferencia por pantalla; se descarta (sin reintentos pendientes) al salir. */
export function useTransferAttempt(): { attempt: TransferAttempt; state: AttemptState } {
  const { api } = useServices();
  const [attempt] = useState(
    () =>
      new TransferAttempt({
        transport: createTransferTransport(api),
        connectivity: netInfoConnectivity,
      }),
  );
  useEffect(() => () => attempt.dispose(), [attempt]);

  // Al completar, los saldos y los movimientos guardados ya no son actuales (MOB-13).
  const queryClient = useQueryClient();
  useEffect(
    () =>
      attempt.subscribe(() => {
        if (attempt.getState().status === 'completed') {
          void queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
        }
      }),
    [attempt, queryClient],
  );
  const state = useSyncExternalStore(attempt.subscribe, attempt.getState);
  return { attempt, state };
}
