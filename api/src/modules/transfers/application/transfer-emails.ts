import { formatMexicoCityDateTime, formatMXN } from '@devchrisvaz/wallet-contract';
import type { NoticeDispatcher } from '../../../platform/mail/notice-dispatcher.js';
import { deliverAfterCommit } from '../../../platform/mail/deliver.js';
import {
  codeBlock,
  detailRows,
  layout,
  noticeBox,
  paragraph,
} from '../../../platform/mail/html.js';
import type { DeliveryStatus, Mailer } from '../../../platform/mail/mailer.js';
import type { AppLogger } from '../../../shared/logger.js';
import { Money } from '../../../shared/money.js';
import type { RejectionReason } from './ports.js';
import type { TransferDetails, TransferDetailsReader } from './transfer-view.js';

export interface EmailContent {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

function minutesText(minutes: number): string {
  return minutes === 1 ? '1 minuto' : `${minutes} minutos`;
}

/**
 * Código para confirmar una transferencia (TRF-15): el código, el monto en es-MX, el nombre del
 * destino y solo los últimos 4 dígitos de su CLABE, para que la persona reconozca la operación. Si
 * es programada, también su fecha y hora (TRF-28).
 */
export function transferOtpEmail(input: {
  readonly code: string;
  readonly amount: Money;
  readonly destinationName: string;
  readonly clabeLast4: string;
  readonly minutes: number;
  readonly scheduledFor?: Date | null;
}): EmailContent {
  const subject = 'Tu código para confirmar una transferencia';
  const amount = input.amount.toDisplayString();
  const destination = `${input.destinationName} (CLABE con terminación ${input.clabeLast4})`;
  const schedule = input.scheduledFor
    ? `Programada para el ${formatMexicoCityDateTime(input.scheduledFor)} (hora de la Ciudad de México).`
    : null;
  const expiry = `Vence en ${minutesText(input.minutes)}.`;
  const warning =
    'Si no fuiste tú, no compartas este código con nadie y responde este correo para que lo revisemos contigo.';
  return {
    subject,
    text: [
      `Tu código de confirmación es ${input.code}.`,
      '',
      `Transferencia de ${amount} a ${destination}.`,
      ...(schedule ? [schedule] : []),
      expiry,
      warning,
    ].join('\n'),
    html: layout(
      subject,
      paragraph('Tu código de confirmación es:') +
        codeBlock(input.code) +
        paragraph(`Transferencia de ${amount} a ${destination}.`) +
        (schedule ? paragraph(schedule) : '') +
        paragraph(expiry) +
        noticeBox('warning', warning),
    ),
  };
}

/** Envía el código de una transferencia a su dueño después del COMMIT (TRF-15, TRF-20). */
export class TransferOtpMailer {
  constructor(
    private readonly mailer: Mailer,
    private readonly logger: AppLogger,
    private readonly ttlMs: number,
  ) {}

  send(details: TransferDetails, code: string): Promise<DeliveryStatus> {
    const content = transferOtpEmail({
      code,
      amount: Money.fromCents(details.amountCents),
      destinationName: details.destinationName,
      clabeLast4: details.destinationClabe.slice(-4),
      minutes: Math.max(1, Math.round(this.ttlMs / 60_000)),
      scheduledFor: details.scheduledFor,
    });
    return deliverAfterCommit(
      this.mailer,
      this.logger,
      { to: details.ownerEmail, ...content },
      'transfer-otp',
    );
  }
}

const FAILURE_REASONS: Record<RejectionReason, string> = {
  INSUFFICIENT_FUNDS: 'saldo insuficiente',
  DAILY_LIMIT_EXCEEDED: 'se alcanzó el límite diario de transferencias',
};

/**
 * Aviso de una programada que no se realizó (TRF-35, D10): el monto en es-MX, el nombre del
 * destino, solo los últimos 4 dígitos de su CLABE, la fecha y hora programadas en palabras (CDMX) y el motivo en
 * lenguaje claro.
 */
export function scheduledFailureEmail(input: {
  readonly amount: Money;
  readonly destinationName: string;
  readonly clabeLast4: string;
  readonly scheduledFor: Date;
  readonly reason: RejectionReason;
}): EmailContent {
  const subject = 'Tu transferencia programada no se realizó';
  const amount = formatMXN(input.amount.toDecimalString());
  const destination = `${input.destinationName} (CLABE con terminación ${input.clabeLast4})`;
  const what = `Tu transferencia de ${amount} a ${destination}, programada para el ${formatMexicoCityDateTime(input.scheduledFor)} (hora de la Ciudad de México), no se realizó.`;
  const why = `Motivo: ${FAILURE_REASONS[input.reason]}.`;
  const next = 'No se movió dinero de tu cuenta. Si todavía quieres enviarla, hazlo desde la app.';
  return {
    subject,
    text: [what, why, next].join('\n'),
    html: layout(subject, paragraph(what) + noticeBox('danger', why) + paragraph(next)),
  };
}

/**
 * Avisa al dueño de una programada que no se realizó (TRF-35). Una falla del envío no lanza; una
 * falla al leer la transferencia sí, y quien llama la registra sin revertir nada.
 */
export interface ScheduledFailureNotifier {
  notify(transferId: string, reason: RejectionReason): Promise<void>;
}

/**
 * Envía el aviso de falla después del COMMIT de la ejecución (D10). Si el envío falla, solo queda
 * un WARN con el `transferId` y sin el correo del usuario: la transferencia sigue FAILED y no se
 * vuelve a ejecutar. Lee el destino y el correo del dueño ya confirmados, fuera de la transacción.
 */
export class ScheduledFailureMailer implements ScheduledFailureNotifier {
  constructor(
    private readonly mailer: Mailer,
    private readonly logger: AppLogger,
    private readonly details: TransferDetailsReader,
  ) {}

  async notify(transferId: string, reason: RejectionReason): Promise<void> {
    const details = await this.details.find(transferId);
    if (!details?.scheduledFor) throw new Error('La programada fallida no existe');
    const content = scheduledFailureEmail({
      amount: Money.fromCents(details.amountCents),
      destinationName: details.destinationName,
      clabeLast4: details.destinationClabe.slice(-4),
      scheduledFor: details.scheduledFor,
      reason,
    });
    await deliverAfterCommit(
      this.mailer,
      this.logger,
      { to: details.ownerEmail, ...content },
      'scheduled-transfer-failed',
      { level: 'warn', context: { transferId } },
    );
  }
}

/**
 * Comprobante al remitente de una transferencia a un tercero que llegó a `COMPLETED` (TRF-38): el
 * monto en es-MX, el nombre del destino, solo los últimos 4 dígitos de su CLABE, el concepto, la
 * referencia si la hay, la fecha y hora de la Ciudad de México y el id de la transferencia.
 */
export function transferReceiptEmail(input: {
  readonly transferId: string;
  readonly amount: Money;
  readonly destinationName: string;
  readonly clabeLast4: string;
  readonly concept: string;
  readonly reference: number | null;
  readonly at: Date;
}): EmailContent {
  const subject = 'Transferencia realizada';
  const intro = 'Realizaste una transferencia desde TreoWallet.';
  const outro =
    'Si no reconoces esta transferencia, responde este correo para que la revisemos contigo.';
  const rows: Array<readonly [string, string]> = [
    ['Monto', input.amount.toDisplayString()],
    ['Destino', `${input.destinationName} (CLABE con terminación ${input.clabeLast4})`],
    ['Concepto', input.concept],
    ...(input.reference === null ? [] : [['Referencia', String(input.reference)] as const]),
    ['Fecha y hora', `${formatMexicoCityDateTime(input.at)} (hora de la Ciudad de México)`],
    ['Número de transferencia', input.transferId],
  ];
  return {
    subject,
    text: [intro, ...rows.map(([label, value]) => `${label}: ${value}.`), outro].join('\n'),
    html: layout(subject, paragraph(intro) + detailRows(rows) + paragraph(outro)),
  };
}

/**
 * Envía el comprobante después del COMMIT de la ejecución que dejó la transferencia `COMPLETED`,
 * sin que la respuesta espere al servidor de correo (TRF-38, D8). Solo a un tercero: los traspasos
 * entre cuentas propias y los fondeos no tienen comprobante. Quien llama decide cuándo (una sola
 * vez por transferencia); aquí solo se descarta lo que no corresponde.
 */
export class TransferReceiptMailer {
  constructor(
    private readonly notices: NoticeDispatcher,
    private readonly clock: { now(): Date },
  ) {}

  send(details: TransferDetails): void {
    if (details.kind !== 'THIRD_PARTY' || details.status !== 'COMPLETED') return;
    const content = transferReceiptEmail({
      transferId: details.id,
      amount: Money.fromCents(details.amountCents),
      destinationName: details.destinationName,
      clabeLast4: details.destinationClabe.slice(-4),
      concept: details.concept,
      reference: details.reference,
      at: details.completedAt ?? this.clock.now(),
    });
    this.notices.send({ to: details.ownerEmail, ...content }, 'transfer-receipt', {
      context: { transferId: details.id },
    });
  }
}
