'use client';

import type { Transfer } from '@devchrisvaz/wallet-contract';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorState, LoadingState } from '@/components/states/states';
import type { ActionProblem } from '@/lib/action-result';
import { useAccountsOverview, useTransfer } from '@/lib/client/queries';
import { queryKeys } from '@/lib/client/query-keys';
import { EndedStep, OtpStep } from './OtpStep';
import { ReceiptStep } from './ReceiptStep';

/**
 * Detalle de una transferencia (`/transfers/[transferId]`): su comprobante o, si sigue
 * `PENDING_OTP`, la captura del código (D4 de web-app).
 */
export function TransferDetailScreen({ transferId }: { transferId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const overview = useAccountsOverview();
  const query = useTransfer(transferId);
  const [ended, setEnded] = useState<ActionProblem | null>(null);

  if (query.isPending || overview.isPending) {
    return <LoadingState label="Cargando la transferencia" />;
  }
  if (query.isError || overview.isError) {
    return (
      <ErrorState
        title="No pudimos cargar la transferencia"
        error={query.error ?? overview.error}
        onRetry={() => {
          void query.refetch();
          void overview.refetch();
        }}
      />
    );
  }

  if (ended) {
    return <EndedStep problem={ended} onRestart={() => router.push('/transfers/new')} />;
  }
  const transfer = query.data;
  if (transfer.status === 'PENDING_OTP') {
    return (
      <OtpStep
        transfer={transfer}
        onConfirmed={(confirmed: Transfer) =>
          queryClient.setQueryData(queryKeys.transfer(transferId), confirmed)
        }
        onEnded={setEnded}
      />
    );
  }
  return <ReceiptStep transfer={transfer} accounts={overview.data.accounts} />;
}
