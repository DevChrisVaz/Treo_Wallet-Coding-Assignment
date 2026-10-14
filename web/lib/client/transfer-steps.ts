import {
  amountInput,
  formatMXN,
  scheduledInstant,
  toCents,
  type Account,
  type Beneficiary,
  type Transfer,
} from '@devchrisvaz/wallet-contract';
import type { ActionProblem } from '@/lib/action-result';
import { maskClabe, normalizeAmountInput } from '@/lib/money';
import { scheduledInstantOf } from './transfer-form';
import {
  recipientOf,
  type TransferFlowState,
  type TransferFormValues,
  type TransferRecipient,
} from './transfer-flow';

const OTP_THRESHOLD_CENTS = toCents('10000.00');

/** Montos mayores a $10,000.00 piden un código por correo (HU6). */
export function requiresOtp(amount: string): boolean {
  return toCents(amount) > OTP_THRESHOLD_CENTS;
}

/** Aviso de la revisión cuando el monto pide código (review-view.tsx de la app móvil). */
export const OTP_NOTICE =
  'Como el monto es mayor a $10,000.00, te enviaremos un código de confirmación a tu correo.';

/** Cuentas que pueden ser el origen: todas menos la cuenta propia de destino (WEB-16, R38). */
export function originsFor(accounts: Account[], recipient: TransferRecipient): Account[] {
  return accounts.filter(
    (account) =>
      !(recipient.destinationType === 'OWN_ACCOUNT' && account.id === recipient.toAccountId),
  );
}

/**
 * Origen por omisión del paso de monto (R38): la cuenta preferida (`?from=`) si puede ser el origen;
 * si es el destino, o no hay preferida, la primera cuenta que no es el destino.
 */
export function defaultOriginId(
  accounts: Account[],
  recipient: TransferRecipient,
  preferredId: string | undefined,
): string | undefined {
  const origins = originsFor(accounts, recipient);
  return (origins.find((account) => account.id === preferredId) ?? origins[0])?.id;
}

/** Título del comprobante: "enviada" solo si se completó; "programada" si quedó programada (WEB-33). */
export function receiptTitle(transfer: Pick<Transfer, 'status'>): string {
  if (transfer.status === 'COMPLETED') return 'Transferencia enviada';
  if (transfer.status === 'SCHEDULED') return 'Transferencia programada';
  return 'Estado de la transferencia';
}

/**
 * Título del intento que terminó sin completarse (WEB-18). Si la API da el estado real
 * (`transferStatus`, p. ej. en `TRANSFER_NOT_PENDING`), el título lo sigue: vencida es "El código
 * venció"; completada o programada (otra sesión la confirmó) no se presenta como fallida.
 */
export function endedTitle(problem: Pick<ActionProblem, 'code' | 'transferStatus'>): string {
  const status = problem.transferStatus;
  if (problem.code === 'TRANSFER_EXPIRED' || status === 'EXPIRED') return 'El código venció';
  if (status === 'COMPLETED' || status === 'SCHEDULED') return 'Estado de la transferencia';
  return 'La transferencia no se realizó';
}

export interface FlowHeading {
  title: string;
  step: number;
  total: number;
  label: string;
}

function confirmTitle(status: Extract<TransferFlowState, { step: 'confirm' }>['status']): string {
  if (status === 'uncertain') return 'Estado sin confirmar';
  if (status === 'rejected') return 'Transferencia rechazada';
  return 'Revisa tu transferencia';
}

/** Título e indicador de cada paso (WEB-30); el total pasa a 4 cuando el monto no pide código (R36). */
export function flowHeading(state: TransferFlowState): FlowHeading {
  switch (state.step) {
    case 'recipient':
      return { title: '¿A quién le envías?', step: 1, total: 5, label: 'Destinatario' };
    case 'form':
      return { title: '¿Cuánto envías?', step: 2, total: 5, label: 'Monto' };
    case 'confirm':
      return {
        title: confirmTitle(state.status),
        step: 3,
        total: requiresOtp(state.draft.request.amount) ? 5 : 4,
        label: 'Revisión',
      };
    case 'otp':
      return { title: 'Confirma con tu código', step: 4, total: 5, label: 'Código' };
    case 'receipt': {
      const total = state.transfer.requiresOtp ? 5 : 4;
      return { title: receiptTitle(state.transfer), step: total, total, label: 'Comprobante' };
    }
    case 'ended':
      return {
        title: endedTitle(state.problem),
        step: 5,
        total: 5,
        label: 'Comprobante',
      };
  }
}

export interface SummaryRows {
  desde?: string;
  para?: string;
  monto?: string;
  concepto?: string;
  referencia?: string;
  /** Instante programado (RFC 3339); sin él la transferencia es inmediata y no hay fila "Cuándo". */
  programada?: string;
}

export interface SummaryContext {
  accounts: Account[];
  beneficiaries: Beneficiary[];
  /** Lo que se va escribiendo en el paso de monto. */
  live: TransferFormValues | null;
  /** Origen por omisión (el del acceso directo `?from=` o la primera cuenta). */
  originId: string | undefined;
  /** `dailyLimit.remaining` tal como lo devuelve la API (WEB-13: sin calcularlo). */
  remaining: string;
}

const accountText = (account: Account | undefined) =>
  account ? `${account.name} · ${maskClabe(account.clabe)}` : undefined;
const beneficiaryText = (beneficiary: Beneficiary | undefined) =>
  beneficiary ? `${beneficiary.alias} · ${maskClabe(beneficiary.clabe)}` : undefined;
const transferText = (transfer: Transfer) =>
  `${transfer.destination.displayName} · •••• ${transfer.destination.clabeLast4}`;

/**
 * El momento elegido con "Programar" si fecha y hora ya forman un instante válido para el contrato;
 * si no, nada (WEB-33).
 */
function typedSchedule(values: TransferFormValues): string | undefined {
  if (values.when !== 'SCHEDULED') return undefined;
  const instant = scheduledInstantOf(values);
  return scheduledInstant.safeParse(instant).success ? instant : undefined;
}

/** Sin referencia (WEB-16): el resumen lo dice en lugar de dejar la fila por definir. */
const NO_REFERENCE = 'Sin referencia';

/** El monto escrito si ya es válido para el contrato (sin separadores); si no, nada. */
function typedAmount(text: string): string | undefined {
  const normalized = normalizeAmountInput(text);
  return amountInput.safeParse(normalized).success ? normalized : undefined;
}

/** Sin las filas que aún no tienen valor: el panel las muestra "Por definir". */
function omitEmpty(rows: SummaryRows): SummaryRows {
  return Object.fromEntries(Object.entries(rows).filter(([, value]) => value)) as SummaryRows;
}

/** Resumen lateral del dashboard (WEB-30): lo capturado y, si pedirá código, el aviso. */
export function transferSummary(
  state: TransferFlowState,
  ctx: SummaryContext,
): { rows: SummaryRows; note: string } {
  const account = (id: string | undefined) => ctx.accounts.find((item) => item.id === id);
  const destination = (recipient: TransferRecipient) =>
    recipient.destinationType === 'OWN_ACCOUNT'
      ? accountText(account(recipient.toAccountId))
      : beneficiaryText(ctx.beneficiaries.find((item) => item.id === recipient.beneficiaryId));
  // Al terminar el intento ya no se avisa del código: queda lo que resta del límite del día.
  const note = (amount: string | undefined, final: boolean) =>
    amount && !final && requiresOtp(amount)
      ? OTP_NOTICE
      : `Te quedan ${formatMXN(ctx.remaining)} de tu límite diario de hoy.`;
  switch (state.step) {
    case 'recipient':
      return {
        rows: omitEmpty({ desde: accountText(account(ctx.originId)) }),
        note: note(undefined, false),
      };
    case 'form': {
      const values = ctx.live;
      const amount = values ? typedAmount(values.amount) : undefined;
      // Lo elegido en el formulario (vacío: "Por definir"); antes de su primer valor, el mismo origen
      // por omisión que el formulario, que nunca es la cuenta de destino (R38).
      const fromId = values
        ? values.fromAccountId
        : defaultOriginId(ctx.accounts, state.recipient, ctx.originId);
      return {
        rows: omitEmpty({
          desde: accountText(account(fromId)),
          para: destination(state.recipient),
          monto: amount ? formatMXN(amount) : undefined,
          concepto: values?.concept || undefined,
          referencia: values?.reference || NO_REFERENCE,
          programada: values ? typedSchedule(values) : undefined,
        }),
        note: note(amount, false),
      };
    }
    case 'confirm': {
      const { request, values } = state.draft;
      return {
        rows: omitEmpty({
          desde: accountText(account(request.fromAccountId)),
          para: destination(recipientOf(values)),
          monto: formatMXN(request.amount),
          concepto: request.concept,
          referencia: request.reference ?? NO_REFERENCE,
          programada: request.scheduledFor,
        }),
        note: note(request.amount, false),
      };
    }
    case 'otp':
    case 'receipt':
    case 'ended': {
      const transfer = state.transfer;
      if (!transfer) return { rows: {}, note: note(undefined, true) };
      return {
        rows: omitEmpty({
          desde: accountText(account(transfer.fromAccountId)),
          para: transferText(transfer),
          monto: formatMXN(transfer.amount),
          concepto: transfer.concept,
          referencia: transfer.reference ?? NO_REFERENCE,
          programada: transfer.scheduledFor ?? undefined,
        }),
        note: note(transfer.amount, state.step !== 'otp'),
      };
    }
  }
}
