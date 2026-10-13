'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { createTransfer } from '@/app/actions/transfers';
import { ErrorState, LoadingState } from '@/components/states/states';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Receipt } from '@/components/ui/Receipt';
import { useAccountsOverview, useBeneficiaries } from '@/lib/client/queries';
import { queryKeys } from '@/lib/client/query-keys';
import { useTransferFlow } from '@/lib/client/transfer-flow';
import { ActionProblemError, isUncertainFailure } from '@/lib/client/unwrap';
import { loginPath } from '@/lib/navigation';
import { ConfirmStep } from './ConfirmStep';
import { StepHeading } from './StepHeading';
import { TransferForm } from './TransferForm';

export interface TransferFlowProps {
  defaultFromAccountId?: string | undefined;
  defaultBeneficiaryId?: string | undefined;
  /** Generador de llaves; por defecto, `createIdempotencyKey` del contrato. */
  generateKey?: (() => string) | undefined;
}

const REPLAYED_MESSAGE = 'Ya habíamos recibido esta transferencia; este es su estado actual.';

/**
 * Flujo de transferencia (WEB-16, WEB-17, D6): formulario → confirmación → código → comprobante.
 * Una sola transferencia por intento: la llave se genera al confirmar y el envío se bloquea desde
 * el primer clic hasta tener respuesta.
 */
export function TransferFlow({
  defaultFromAccountId,
  defaultBeneficiaryId,
  generateKey,
}: TransferFlowProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const overview = useAccountsOverview();
  const beneficiaries = useBeneficiaries();
  const flow = useTransferFlow(generateKey);
  // Candado síncrono: un segundo clic llega antes de que React vuelva a pintar el botón.
  const inFlight = useRef(false);

  async function send() {
    const { state, key } = flow;
    if (inFlight.current || state.step !== 'confirm' || !key) return;
    inFlight.current = true;
    flow.sending();
    try {
      const result = await createTransfer(state.draft.request, key);
      if (result.ok) {
        flow.sent(result.data.transfer, result.data.replayed);
        return;
      }
      const { problem } = result;
      if (problem.status === 401) {
        router.replace(loginPath('/transfers/new', 'expired'));
        return;
      }
      if (isUncertainFailure(new ActionProblemError(problem))) {
        flow.uncertain(new ActionProblemError(problem));
        return;
      }
      // El saldo mostrado junto al rechazo debe ser el vigente.
      void queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
      flow.rejected(problem);
    } catch (error) {
      flow.uncertain(error);
    } finally {
      inFlight.current = false;
    }
  }

  if (overview.isPending || beneficiaries.isPending) {
    return <LoadingState label="Cargando tus cuentas y beneficiarios" />;
  }
  if (overview.isError || beneficiaries.isError) {
    return (
      <ErrorState
        title="No pudimos cargar tus cuentas y beneficiarios"
        error={overview.error ?? beneficiaries.error}
        onRetry={() => {
          void overview.refetch();
          void beneficiaries.refetch();
        }}
      />
    );
  }

  const accounts = overview.data.accounts;
  const { state } = flow;

  switch (state.step) {
    case 'form':
      return (
        <TransferForm
          accounts={accounts}
          beneficiaries={beneficiaries.data.items}
          initialValues={state.draft?.values}
          defaultFromAccountId={defaultFromAccountId}
          defaultBeneficiaryId={defaultBeneficiaryId}
          onSubmit={flow.review}
        />
      );
    case 'confirm':
      return (
        <ConfirmStep
          draft={state.draft}
          accounts={accounts}
          beneficiaries={beneficiaries.data.items}
          status={state.status}
          problem={state.problem}
          onSend={() => void send()}
          onEdit={flow.edit}
        />
      );
    case 'otp':
      return (
        <section aria-labelledby="otp-title" className="grid gap-5">
          {state.replayed ? <InlineAlert tone="info">{REPLAYED_MESSAGE}</InlineAlert> : null}
          <StepHeading id="otp-title">Ingresa el código</StepHeading>
        </section>
      );
    case 'receipt':
      return (
        <section aria-label="Transferencia enviada" className="grid gap-5">
          {state.replayed ? <InlineAlert tone="info">{REPLAYED_MESSAGE}</InlineAlert> : null}
          <Receipt
            transfer={state.transfer}
            fromAccount={accounts.find((account) => account.id === state.transfer.fromAccountId)}
          />
        </section>
      );
    case 'ended':
      return null;
  }
}
