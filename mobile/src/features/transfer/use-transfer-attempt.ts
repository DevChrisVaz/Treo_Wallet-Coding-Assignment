import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { useServices } from '@/app-services';
import { queryKeys } from '@/features/accounts/queries';
import {
  clearPendingTransfer,
  loadPendingTransfer,
  savePendingTransfer,
} from '@/session/pending-transfer';

import { netInfoConnectivity } from './connectivity';
import { TransferAttempt, type AttemptState, type PendingStore } from './transfer-attempt';
import { createTransferTransport } from './transport';

/** El intento en vuelo vive en el almacenamiento seguro (MOB-11); la sesión lo borra al cerrarse. */
const pendingStore: PendingStore = {
  save: (frozen) => savePendingTransfer(frozen),
  load: () => loadPendingTransfer(),
  clear: () => clearPendingTransfer(),
};

/**
 * Un intento de transferencia por pantalla; se descarta (sin reintentos pendientes) al salir. Si
 * había uno guardado de una app cerrada a mitad del envío, al montar lo retoma con la misma llave.
 */
export function useTransferAttempt(): { attempt: TransferAttempt; state: AttemptState } {
  const { api } = useServices();
  const [attempt] = useState(
    () =>
      new TransferAttempt({
        transport: createTransferTransport(api),
        connectivity: netInfoConnectivity,
        pending: pendingStore,
      }),
  );
  useEffect(() => () => attempt.dispose(), [attempt]);
  useEffect(() => {
    void attempt.resume();
  }, [attempt]);

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
