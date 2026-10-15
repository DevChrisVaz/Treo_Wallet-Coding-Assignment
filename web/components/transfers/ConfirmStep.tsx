'use client';

import { formatMXN, type Account, type Beneficiary } from '@devchrisvaz/wallet-contract';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { ListSection } from '@/components/ui/ListSection';
import { StepActions } from '@/components/ui/StepActions';
import type { ActionProblem } from '@/lib/action-result';
import { describeProblem } from '@/lib/client/problem-messages';
import type { ConfirmStatus, TransferDraft } from '@/lib/client/transfer-flow';
import { OTP_NOTICE, requiresOtp } from '@/lib/client/transfer-steps';
import { maskClabe } from '@/lib/money';
import { scheduledSendText } from './ScheduleField';
import { AmountBlock, SummaryRow } from './TransferSummary';

export interface ConfirmStepProps {
  draft: TransferDraft;
  accounts: Account[];
  beneficiaries: Beneficiary[];
  status: ConfirmStatus;
  problem?: ActionProblem | undefined;
  onSend: () => void;
  onEdit: () => void;
}

/** Título de la alerta según el rechazo (D17 de web-app). */
function rejectionTitle(problem: ActionProblem): string | undefined {
  if (problem.code === 'INSUFFICIENT_FUNDS') return 'Saldo insuficiente';
  if (problem.code === 'DAILY_LIMIT_EXCEEDED') return 'Superaste tu límite diario';
  return undefined;
}

/**
 * Revisión (WEB-16, WEB-17, WEB-30): el monto como protagonista, el resumen del intento (con
 * "Cuándo" si es programada, WEB-33) y el envío con el botón deshabilitado desde el primer clic.
 * Ante un fallo de red o 5xx solo se ofrece reintentar (con la misma llave); editar en ese momento
 * podría duplicar una transferencia que sí se hizo.
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
    ? `${destination.name} · ${maskClabe(destination.clabe)}`
    : beneficiary
      ? `${beneficiary.alias} · ${maskClabe(beneficiary.clabe)}`
      : '';
  const sending = status === 'sending';

  return (
    <>
      <AmountBlock amount={formatMXN(request.amount)} />
      <ListSection>
        <dl className="divide-y divide-border">
          <SummaryRow
            term="Desde"
            value={origin ? `${origin.name} · ${maskClabe(origin.clabe)}` : ''}
          />
          <SummaryRow term="Para" value={destinationText} />
          <SummaryRow term="Concepto" value={request.concept} />
          {request.reference ? <SummaryRow term="Referencia" value={request.reference} /> : null}
          {request.scheduledFor ? (
            <SummaryRow term="Cuándo" value={scheduledSendText(request.scheduledFor)} />
          ) : null}
        </dl>
      </ListSection>
      {requiresOtp(request.amount) ? <InlineAlert tone="info">{OTP_NOTICE}</InlineAlert> : null}

      {status === 'uncertain' ? (
        // Ni éxito ni falla: un aviso, como en la app móvil (R37).
        <InlineAlert
          tone="warning"
          title="No pudimos confirmar el estado de tu transferencia"
          focusOnMount
        >
          Puede que se haya realizado. Reintenta para conocer el resultado: no se enviará dos veces.
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

      {status === 'rejected' ? (
        <StepActions>
          <Button variant="secondary" onClick={onEdit}>
            Corregir
          </Button>
        </StepActions>
      ) : status === 'uncertain' ? (
        <StepActions>
          <Button onClick={onSend}>Reintentar</Button>
        </StepActions>
      ) : (
        <StepActions stacked>
          <Button loading={sending} loadingLabel="Enviando…" onClick={onSend}>
            Enviar
          </Button>
          <Button variant="ghost" disabled={sending} onClick={onEdit}>
            Editar
          </Button>
        </StepActions>
      )}
    </>
  );
}
