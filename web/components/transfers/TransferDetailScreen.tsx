'use client';

import type { Transfer } from '@devchrisvaz/wallet-contract';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorState, LoadingState } from '@/components/states/states';
import type { ActionProblem } from '@/lib/action-result';
import { useAccountsOverview, useTransfer } from '@/lib/client/queries';
import { queryKeys } from '@/lib/client/query-keys';
import { endedTitle, receiptTitle } from '@/lib/client/transfer-steps';
import { EndedStep, OtpStep } from './OtpStep';
import { ReceiptStep } from './ReceiptStep';
import { StepHeading } from './StepHeading';

/**
 * Detalle de una transferencia (`/transfers/[transferId]`): su comprobante o, si sigue
 * `PENDING_OTP`, la captura del código (D4 de web-app). La página tiene pestañas, así que las acciones
 * de cada paso van en línea.
 */
export function TransferDetailScreen({ transferId }: { transferId: string }) {
  return (
    <div className="grid gap-5 dashboard:max-w-2xl">
      <TransferDetailContent transferId={transferId} />
    </div>
  );
}

function TransferDetailContent({ transferId }: { transferId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const overview = useAccountsOverview();
  const query = useTransfer(transferId);
  const [ended, setEnded] = useState<ActionProblem | null>(null);
  // Confirmada en esta página: el título del comprobante aparece y toma el foco (WEB-23); al abrirla
  // ya resuelta no hay título de paso.
  const [confirmedHere, setConfirmedHere] = useState(false);

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

  // Cada título lleva `key`: al cambiar de paso se monta de nuevo y, si corresponde, toma el foco.
  if (ended) {
    return (
      <>
        {/* La alerta del intento recibe el foco (WEB-23); el título solo nombra el paso. */}
        <StepHeading key="ended" focus={false}>
          {endedTitle(ended)}
        </StepHeading>
        <EndedStep
          problem={ended}
          transfer={query.data}
          accounts={overview.data.accounts}
          actions="inline"
          onRestart={() => router.push('/transfers/new')}
        />
      </>
    );
  }
  const transfer = query.data;
  if (transfer.status === 'PENDING_OTP') {
    return (
      <>
        <StepHeading key="otp">Confirma con tu código</StepHeading>
        <OtpStep
          transfer={transfer}
          onConfirmed={(confirmed: Transfer) => {
            setConfirmedHere(true);
            queryClient.setQueryData(queryKeys.transfer(transferId), confirmed);
          }}
          onEnded={setEnded}
          actions="inline"
        />
      </>
    );
  }
  // Al abrirla ya resuelta, la página ("Transferencia") y el comprobante bastan, como en la historia
  // aprobada (WEB-25). Confirmada aquí, el título del paso anuncia el resultado y toma el foco (WEB-23).
  return (
    <>
      {confirmedHere ? <StepHeading key="receipt">{receiptTitle(transfer)}</StepHeading> : null}
      <ReceiptStep transfer={transfer} accounts={overview.data.accounts} actions="inline" />
    </>
  );
}
