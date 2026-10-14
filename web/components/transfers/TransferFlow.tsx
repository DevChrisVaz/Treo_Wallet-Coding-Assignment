'use client';

import type { Account, Beneficiary } from '@devchrisvaz/wallet-contract';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { createTransfer } from '@/app/actions/transfers';
import { ErrorState, LoadingState } from '@/components/states/states';
import { FlowHeader } from '@/components/ui/FlowHeader';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { useAccountsOverview, useBeneficiaries } from '@/lib/client/queries';
import { queryKeys } from '@/lib/client/query-keys';
import {
  useTransferFlow,
  type TransferFormValues,
  type TransferRecipient,
} from '@/lib/client/transfer-flow';
import { flowHeading, transferSummary, type FlowHeading } from '@/lib/client/transfer-steps';
import { ActionProblemError, isUncertainFailure } from '@/lib/client/unwrap';
import { loginPath } from '@/lib/navigation';
import { ConfirmStep } from './ConfirmStep';
import { EndedStep, OtpStep } from './OtpStep';
import { ReceiptStep } from './ReceiptStep';
import { RecipientStep } from './RecipientStep';
import { TransferForm } from './TransferForm';
import { TransferSummary } from './TransferSummary';

export interface TransferFlowProps {
  defaultFromAccountId?: string | undefined;
  defaultBeneficiaryId?: string | undefined;
  /** Generador de llaves; por defecto, `createIdempotencyKey` del contrato. */
  generateKey?: (() => string) | undefined;
}

const REPLAYED_MESSAGE = 'Ya habíamos recibido esta transferencia; este es su estado actual.';

/** `id` del título del paso (el h1 de FlowHeader), que nombra la región del paso. */
export const FLOW_TITLE_ID = 'transfer-flow-title';
const RECIPIENT = flowHeading({ step: 'recipient', draft: null });

/** Encabezado del paso, el paso (región nombrada por su título) y el resumen del dashboard (WEB-30). */
function FlowFrame({
  heading,
  summary,
  children,
}: {
  heading: FlowHeading;
  summary?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      {/* FlowHeader antes del paso: los efectos corren en orden de hermanos, así el foco de una alerta
          (focusOnMount, WEB-23) gana al del título. No cambiar este orden. */}
      <FlowHeader
        titleId={FLOW_TITLE_ID}
        focusTitle
        title={heading.title}
        step={heading.step}
        total={heading.total}
        stepLabel={heading.label}
        closeHref="/"
      />
      <div className="grid gap-8 dashboard:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-labelledby={FLOW_TITLE_ID} className="grid content-start gap-5">
          {children}
        </section>
        {summary}
      </div>
    </>
  );
}

/**
 * Flujo de transferencia (WEB-16, WEB-17, WEB-30, D6): destinatario → monto → revisión → código →
 * comprobante. Primero espera las cuentas y los beneficiarios; los pasos viven en `TransferSteps`.
 */
export function TransferFlow({
  defaultFromAccountId,
  defaultBeneficiaryId,
  generateKey,
}: TransferFlowProps) {
  const overview = useAccountsOverview();
  const beneficiaries = useBeneficiaries();
  // Una relectura que falla con datos en caché no desmonta el intento en curso.
  if (!overview.data || !beneficiaries.data) {
    // Con un acceso directo a un beneficiario se espera en el paso de monto, donde empezará.
    const heading = defaultBeneficiaryId
      ? flowHeading({
          step: 'form',
          draft: null,
          recipient: { destinationType: 'BENEFICIARY', beneficiaryId: defaultBeneficiaryId },
        })
      : RECIPIENT;
    return (
      <FlowFrame heading={heading}>
        {overview.isError || beneficiaries.isError ? (
          <ErrorState
            title="No pudimos cargar tus cuentas y beneficiarios"
            error={overview.error ?? beneficiaries.error}
            onRetry={() => {
              void overview.refetch();
              void beneficiaries.refetch();
            }}
          />
        ) : (
          <LoadingState label="Cargando tus cuentas y beneficiarios" />
        )}
      </FlowFrame>
    );
  }
  const items = beneficiaries.data.items;
  // Con el beneficiario de un acceso directo (`?beneficiary=`) el flujo empieza en el monto.
  const start: TransferRecipient | null = items.some((item) => item.id === defaultBeneficiaryId)
    ? { destinationType: 'BENEFICIARY', beneficiaryId: defaultBeneficiaryId as string }
    : null;
  return (
    <TransferSteps
      accounts={overview.data.accounts}
      remaining={overview.data.dailyLimit.remaining}
      beneficiaries={items}
      defaultFromAccountId={defaultFromAccountId}
      start={start}
      generateKey={generateKey}
    />
  );
}

interface TransferStepsProps {
  accounts: Account[];
  /** `dailyLimit.remaining` de la API, para el resumen. */
  remaining: string;
  beneficiaries: Beneficiary[];
  defaultFromAccountId: string | undefined;
  start: TransferRecipient | null;
  generateKey: (() => string) | undefined;
}

/**
 * Los pasos del intento. Una sola transferencia por intento: la llave se genera al pasar a la
 * revisión y el envío se bloquea desde el primer clic hasta tener respuesta.
 */
function TransferSteps({
  accounts,
  remaining,
  beneficiaries,
  defaultFromAccountId,
  start,
  generateKey,
}: TransferStepsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const flow = useTransferFlow(generateKey, start);
  // Candado síncrono: un segundo clic llega antes de que React vuelva a pintar el botón.
  const inFlight = useRef(false);
  // Lo que se va escribiendo en el paso de monto, para el resumen del dashboard.
  const [live, setLive] = useState<TransferFormValues | null>(null);
  const originId =
    accounts.find((account) => account.id === defaultFromAccountId)?.id ?? accounts[0]?.id;

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

  function restart() {
    // El intento nuevo empieza sin lo escrito en el anterior (también en el resumen).
    setLive(null);
    flow.restart();
  }

  const { state } = flow;
  let body: ReactNode;
  switch (state.step) {
    case 'recipient':
      body = (
        <RecipientStep accounts={accounts} beneficiaries={beneficiaries} onChoose={flow.choose} />
      );
      break;
    case 'form':
      body = (
        <TransferForm
          accounts={accounts}
          beneficiaries={beneficiaries}
          recipient={state.recipient}
          initialValues={state.draft?.values}
          defaultFromAccountId={defaultFromAccountId}
          onSubmit={flow.review}
          onValuesChange={setLive}
        />
      );
      break;
    case 'confirm':
      body = (
        <ConfirmStep
          draft={state.draft}
          accounts={accounts}
          beneficiaries={beneficiaries}
          status={state.status}
          problem={state.problem}
          onSend={() => void send()}
          onEdit={flow.edit}
        />
      );
      break;
    case 'otp':
      body = (
        <>
          {state.replayed ? <InlineAlert tone="info">{REPLAYED_MESSAGE}</InlineAlert> : null}
          <OtpStep transfer={state.transfer} onConfirmed={flow.confirmed} onEnded={flow.ended} />
        </>
      );
      break;
    case 'receipt':
      body = (
        <>
          {state.replayed ? <InlineAlert tone="info">{REPLAYED_MESSAGE}</InlineAlert> : null}
          <ReceiptStep transfer={state.transfer} accounts={accounts} onRestart={restart} />
        </>
      );
      break;
    case 'ended':
      body = (
        <EndedStep
          problem={state.problem}
          transfer={state.transfer}
          accounts={accounts}
          onRestart={restart}
        />
      );
      break;
  }

  return (
    <FlowFrame
      heading={flowHeading(state)}
      summary={
        <TransferSummary
          {...transferSummary(state, { accounts, beneficiaries, live, originId, remaining })}
        />
      }
    >
      {body}
    </FlowFrame>
  );
}
