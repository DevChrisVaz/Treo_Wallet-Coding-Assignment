'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { ErrorState, LoadingState } from '@/components/states/states';
import { EmptyState } from '@/components/ui/EmptyState';
import { selectedAccount, useAccountSelection } from '@/lib/client/account-selection';
import { useAccountsOverview } from '@/lib/client/queries';

/** `/movements` (pestaña Movimientos): abre el historial de la cuenta elegida o de la primera. */
export function MovementsIndexScreen() {
  const router = useRouter();
  const overview = useAccountsOverview();
  const { accountId } = useAccountSelection();
  const target = overview.data ? selectedAccount(overview.data.accounts, accountId) : undefined;

  useEffect(() => {
    if (target) router.replace(`/accounts/${target.id}/movements`);
  }, [router, target]);

  if (overview.isError) {
    return (
      <ErrorState
        title="No pudimos cargar tus cuentas"
        error={overview.error}
        onRetry={() => void overview.refetch()}
      />
    );
  }
  if (overview.data?.accounts.length === 0) {
    return (
      <EmptyState
        icon="account"
        title="Aún no tienes cuentas"
        description="Tus cuentas Principal y Ahorro se abren al verificar tu correo."
      />
    );
  }
  return <LoadingState label="Cargando movimientos" />;
}
