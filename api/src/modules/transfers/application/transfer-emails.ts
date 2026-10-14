import { deliverAfterCommit } from '../../../platform/mail/deliver.js';
import { escapeHtml, layout } from '../../../platform/mail/html.js';
import type { DeliveryStatus, Mailer } from '../../../platform/mail/mailer.js';
import type { AppLogger } from '../../../shared/logger.js';
import { Money } from '../../../shared/money.js';
import type { TransferDetails } from './transfer-view.js';

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
