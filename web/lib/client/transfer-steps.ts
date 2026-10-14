import {
  amountInput,
  formatMXN,
  toCents,
  type Account,
  type Beneficiary,
  type Transfer,
} from '@devchrisvaz/wallet-contract';
import { maskClabe, normalizeAmountInput } from '@/lib/money';
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
      const title =
        state.transfer.status === 'COMPLETED'
          ? 'Transferencia enviada'
          : 'Estado de la transferencia';
      return { title, step: total, total, label: 'Comprobante' };
    }
    case 'ended':
      return {
        title:
          state.problem.code === 'TRANSFER_EXPIRED'
            ? 'El código venció'
            : 'La transferencia no se realizó',
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
      return {
        rows: omitEmpty({
          desde: accountText(account(values?.fromAccountId || ctx.originId)),
          para: destination(state.recipient),
          monto: amount ? formatMXN(amount) : undefined,
          concepto: values?.concept || undefined,
          referencia: values?.reference || undefined,
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
          referencia: request.reference,
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
          referencia: transfer.reference,
        }),
        note: note(transfer.amount, state.step !== 'otp'),
      };
    }
  }
}
