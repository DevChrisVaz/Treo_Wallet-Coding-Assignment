import type {
  AccountsOverview,
  BeneficiaryList,
  Movement,
  MovementPage,
  Transfer,
} from '@devchrisvaz/wallet-contract';
import { useQuery } from '@tanstack/react-query';
import { bffGet } from './bff';
import { queryKeys } from './query-keys';

/** Cuentas con saldo y el límite diario que calcula la API (WEB-13). */
export function useAccountsOverview() {
  return useQuery({
    queryKey: queryKeys.accounts,
    queryFn: () => bffGet<AccountsOverview>('accounts'),
  });
}

/** Movimientos que muestra Inicio por cuenta (WEB-28; D9: el mismo endpoint con `limit=5`). */
export const LATEST_MOVEMENTS_LIMIT = 5;

export function useLatestMovements(accountId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.latestMovements(accountId ?? ''),
    queryFn: () =>
      bffGet<MovementPage>(`accounts/${accountId}/movements`, {
        limit: String(LATEST_MOVEMENTS_LIMIT),
      }),
    enabled: accountId !== undefined,
    select: (page): Movement[] => page.items.slice(0, LATEST_MOVEMENTS_LIMIT),
  });
}

/** Beneficiarios del usuario (WEB-15). */
export function useBeneficiaries() {
  return useQuery({
    queryKey: queryKeys.beneficiaries,
    queryFn: () => bffGet<BeneficiaryList>('beneficiaries'),
  });
}

/** Una transferencia, que sirve de comprobante (WEB-16). */
export function useTransfer(transferId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.transfer(transferId),
    queryFn: () => bffGet<Transfer>(`transfers/${transferId}`),
    enabled,
  });
}
