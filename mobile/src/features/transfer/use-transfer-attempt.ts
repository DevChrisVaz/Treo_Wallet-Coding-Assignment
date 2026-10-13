import { useEffect, useState, useSyncExternalStore } from 'react';

import { useServices } from '@/app-services';

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
  const state = useSyncExternalStore(attempt.subscribe, attempt.getState);
  return { attempt, state };
}
