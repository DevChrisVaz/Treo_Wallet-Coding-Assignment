import { formatMXN } from '@devchrisvaz/wallet-contract';
import { deliverAfterCommit } from '../../../platform/mail/deliver.js';
import { escapeHtml, layout } from '../../../platform/mail/html.js';
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

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * Fecha calendario (`YYYY-MM-DD`) en palabras: `"20 de octubre de 2026"`. Se arma con el texto de
 * la fecha, sin `Date` ni zonas horarias, para que no se recorra un día ni dependa de ICU.
 */
export function longSpanishDate(day: string): string {
  const [year, month, date] = day.split('-').map(Number) as [number, number, number];
  return `${date} de ${MONTHS[month - 1] ?? ''} de ${year}`;
}

/**
 * Código para confirmar una transferencia (TRF-15): el código, el monto en es-MX, el nombre del
 * destino y solo los últimos 4 dígitos de su CLABE, para que la persona reconozca la operación. Si
 * es programada, también su fecha (TRF-28).
 */
export function transferOtpEmail(input: {
  readonly code: string;
  readonly amount: Money;
  readonly destinationName: string;
  readonly clabeLast4: string;
  readonly minutes: number;
  readonly scheduledFor?: string | null;
}): EmailContent {
  const subject = 'Tu código para confirmar una transferencia';
  const amount = input.amount.toDisplayString();
  const destination = `${input.destinationName} (CLABE con terminación ${input.clabeLast4})`;
  const schedule = input.scheduledFor
    ? `Programada para el ${longSpanishDate(input.scheduledFor)}.`
    : null;
  const expiry = `Vence en ${minutesText(input.minutes)}.`;
  const warning = 'Si no fuiste tú, no compartas este código con nadie y cambia tu contraseña.';
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
      `<p>Tu código de confirmación es <strong style="font-size: 20px;">${escapeHtml(input.code)}</strong>.</p>` +
        `<p>Transferencia de <strong>${escapeHtml(amount)}</strong> a ${escapeHtml(destination)}.</p>` +
        (schedule ? `<p>${escapeHtml(schedule)}</p>` : '') +
        `<p>${escapeHtml(expiry)}</p>` +
        `<p>${escapeHtml(warning)}</p>`,
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
 * destino, solo los últimos 4 dígitos de su CLABE, la fecha programada en palabras y el motivo en
 * lenguaje claro.
 */
export function scheduledFailureEmail(input: {
  readonly amount: Money;
  readonly destinationName: string;
  readonly clabeLast4: string;
  readonly scheduledFor: string;
  readonly reason: RejectionReason;
}): EmailContent {
  const subject = 'Tu transferencia programada no se realizó';
  const amount = formatMXN(input.amount.toDecimalString());
  const destination = `${input.destinationName} (CLABE con terminación ${input.clabeLast4})`;
  const what = `Tu transferencia de ${amount} a ${destination}, programada para el ${longSpanishDate(input.scheduledFor)}, no se realizó.`;
  const why = `Motivo: ${FAILURE_REASONS[input.reason]}.`;
  const next = 'No se movió dinero de tu cuenta. Si todavía quieres enviarla, hazlo desde la app.';
  return {
    subject,
    text: [what, why, next].join('\n'),
    html: layout(
      subject,
      `<p>${escapeHtml(what)}</p><p><strong>${escapeHtml(why)}</strong></p><p>${escapeHtml(next)}</p>`,
    ),
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
