import type { ScheduledTransferList } from '@devchrisvaz/wallet-contract';
import { useQuery } from '@tanstack/react-query';
import { bffGet } from './bff';

/** Clave de TanStack Query de las transferencias programadas (WEB-34). */
export const scheduledTransfersKey = ['scheduledTransfers'] as const;

/** Programadas del usuario (`listScheduledTransfers`) por el proxy de lecturas, en el orden de la API. */
export function useScheduledTransfers() {
  return useQuery({
    queryKey: scheduledTransfersKey,
    queryFn: () => bffGet<ScheduledTransferList>('transfers/scheduled'),
  });
}
