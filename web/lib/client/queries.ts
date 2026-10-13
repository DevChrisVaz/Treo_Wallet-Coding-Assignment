import type { AccountsOverview, BeneficiaryList, Transfer } from '@devchrisvaz/wallet-contract';
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
