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

/**
 * Código para confirmar una transferencia (TRF-15): el código, el monto en es-MX, el nombre del
 * destino y solo los últimos 4 dígitos de su CLABE, para que la persona reconozca la operación.
 */
export function transferOtpEmail(input: {
  readonly code: string;
  readonly amount: Money;
  readonly destinationName: string;
  readonly clabeLast4: string;
  readonly minutes: number;
}): EmailContent {
  const subject = 'Tu código para confirmar una transferencia';
  const amount = input.amount.toDisplayString();
  const destination = `${input.destinationName} (CLABE con terminación ${input.clabeLast4})`;
  const expiry = `Vence en ${minutesText(input.minutes)}.`;
  const warning = 'Si no fuiste tú, no compartas este código con nadie y cambia tu contraseña.';
  return {
    subject,
    text: [
      `Tu código de confirmación es ${input.code}.`,
      '',
      `Transferencia de ${amount} a ${destination}.`,
      expiry,
      warning,
    ].join('\n'),
    html: layout(
      subject,
      `<p>Tu código de confirmación es <strong style="font-size: 20px;">${escapeHtml(input.code)}</strong>.</p>` +
        `<p>Transferencia de <strong>${escapeHtml(amount)}</strong> a ${escapeHtml(destination)}.</p>` +
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
    });
    return deliverAfterCommit(
      this.mailer,
      this.logger,
      { to: details.ownerEmail, ...content },
      'transfer-otp',
    );
  }
}
