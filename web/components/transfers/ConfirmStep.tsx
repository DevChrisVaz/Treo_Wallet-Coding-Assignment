'use client';

import { formatMXN, type Account, type Beneficiary } from '@devchrisvaz/wallet-contract';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import type { ActionProblem } from '@/lib/action-result';
import { describeProblem } from '@/lib/client/problem-messages';
import type { ConfirmStatus, TransferDraft } from '@/lib/client/transfer-flow';
import { maskClabe } from '@/lib/money';
import { scheduledSendText } from './ScheduleField';
import { StepHeading } from './StepHeading';

export interface ConfirmStepProps {
  draft: TransferDraft;
  accounts: Account[];
  beneficiaries: Beneficiary[];
  status: ConfirmStatus;
  problem?: ActionProblem | undefined;
  onSend: () => void;
  onEdit: () => void;
}

function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-border py-3 sm:grid-cols-3 sm:gap-4">
      <dt className="text-body-sm text-fg-secondary">{term}</dt>
      <dd className="text-body text-fg sm:col-span-2">{children}</dd>
    </div>
  );
}

/** Título de la alerta según el rechazo (D17 de web-app). */
function rejectionTitle(problem: ActionProblem): string | undefined {
  if (problem.code === 'INSUFFICIENT_FUNDS') return 'Saldo insuficiente';
  if (problem.code === 'DAILY_LIMIT_EXCEEDED') return 'Superaste tu límite diario';
  return undefined;
}

/**
 * Confirmación (WEB-16, WEB-17): resumen del intento y envío con el botón deshabilitado desde el
 * primer clic. Ante un fallo de red o 5xx solo se ofrece reintentar (con la misma llave); editar
 * en ese momento podría duplicar una transferencia que sí se hizo.
 */
export function ConfirmStep({
  draft,
  accounts,
  beneficiaries,
  status,
  problem,
  onSend,
  onEdit,
}: ConfirmStepProps) {
  const { request } = draft;
  const origin = accounts.find((account) => account.id === request.fromAccountId);
  const destination =
    request.destination.type === 'OWN_ACCOUNT'
      ? accounts.find(
          (account) =>
            'accountId' in request.destination && account.id === request.destination.accountId,
        )
      : undefined;
  const beneficiary =
    request.destination.type === 'BENEFICIARY'
      ? beneficiaries.find(
          (item) =>
            'beneficiaryId' in request.destination && item.id === request.destination.beneficiaryId,
        )
      : undefined;
  const destinationText = destination
    ? `${destination.name} ${maskClabe(destination.clabe)}`
    : beneficiary
      ? `${beneficiary.alias} ${maskClabe(beneficiary.clabe)}`
      : '';
  const sending = status === 'sending';

  return (
    <section aria-labelledby="confirm-title" className="grid gap-5">
      <StepHeading id="confirm-title">Confirma la transferencia</StepHeading>
      <dl className="rounded-lg bg-surface p-6 shadow-card">
        <Row term="Monto">
          <span className="text-h3 tabular-nums">{formatMXN(request.amount)}</span>
        </Row>
        <Row term="Origen">{origin ? `${origin.name} ${maskClabe(origin.clabe)}` : ''}</Row>
        <Row term="Destino">{destinationText}</Row>
        <Row term="Concepto">{request.concept}</Row>
        <Row term="Referencia">{request.reference}</Row>
        {request.scheduledFor ? (
          <Row term="Cuándo">{scheduledSendText(request.scheduledFor)}</Row>
        ) : null}
      </dl>

      {status === 'uncertain' ? (
        <InlineAlert tone="danger" title="No sabemos si la transferencia se envió" focusOnMount>
          Revisa tu conexión y reintenta: usamos el mismo identificador, así que no se enviará dos
          veces.
        </InlineAlert>
      ) : null}

      {status === 'rejected' && problem ? (
        <InlineAlert tone="danger" title={rejectionTitle(problem)} focusOnMount>
          <p>{describeProblem(problem)}</p>
          {problem.code === 'INSUFFICIENT_FUNDS' && origin ? (
            <p>
              Saldo disponible en {origin.name}: {formatMXN(origin.balance)}
            </p>
          ) : null}
        </InlineAlert>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {status === 'rejected' ? (
          <Button onClick={onEdit}>Corregir</Button>
        ) : status === 'uncertain' ? (
          <Button onClick={onSend}>Reintentar</Button>
        ) : (
          <>
            <Button loading={sending} loadingLabel="Enviando…" onClick={onSend}>
              Enviar
            </Button>
            <Button variant="secondary" disabled={sending} onClick={onEdit}>
              Editar
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
