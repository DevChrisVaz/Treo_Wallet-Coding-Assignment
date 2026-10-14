import type { AppLogger } from '../../shared/logger.js';
import { maskEmail } from '../../shared/masking.js';
import type { DeliveryStatus, MailMessage, Mailer } from './mailer.js';

/**
 * Envía un correo cuando la transacción que lo origina ya se confirmó (PLT-16). Una falla no
 * revierte nada ni se propaga: se registra con el destinatario enmascarado, sin el cuerpo (que trae
 * el código) y sin direcciones en el mensaje del error; el usuario puede pedir un reenvío.
 *
 * Con `context`, el registro identifica la operación por sus ids (por ejemplo el `transferId` de un
 * aviso) y no lleva el destinatario; `level` permite registrarlo como WARN cuando el correo es un
 * aviso y no algo que el usuario necesite para continuar (TRF-35).
 */
export async function deliverAfterCommit(
  mailer: Mailer,
  logger: AppLogger,
  message: MailMessage,
  template: string,
  options: {
    readonly level?: 'warn' | 'error';
    readonly context?: Readonly<Record<string, string>>;
  } = {},
): Promise<DeliveryStatus> {
  try {
    await mailer.send(message);
    return 'SENT';
  } catch (error) {
    const source = error as {
      name?: unknown;
      message?: unknown;
      code?: unknown;
      responseCode?: unknown;
    };
    const reason =
      typeof source.message === 'string'
        ? source.message.replace(/[^\s<>()"']+@[^\s<>()"']+/g, (address) => maskEmail(address))
        : undefined;
    logger[options.level ?? 'error'](
      {
        ...(options.context ?? { to: message.to }),
        template,
        failure: {
          type: source.name,
          errorCode: source.code,
          responseCode: source.responseCode,
          reason,
        },
      },
      'mail delivery failed',
    );
    return 'FAILED';
  }
}
