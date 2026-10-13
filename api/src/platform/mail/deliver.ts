import type { AppLogger } from '../../shared/logger.js';
import { maskEmail } from '../../shared/masking.js';
import type { DeliveryStatus, MailMessage, Mailer } from './mailer.js';

/**
 * Envía un correo cuando la transacción que lo origina ya se confirmó (PLT-16). Una falla no
 * revierte nada ni se propaga: se registra con el destinatario enmascarado, sin el cuerpo (que trae
 * el código) y sin direcciones en el mensaje del error; el usuario puede pedir un reenvío.
 */
export async function deliverAfterCommit(
  mailer: Mailer,
  logger: AppLogger,
  message: MailMessage,
  template: string,
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
    logger.error(
      {
        to: message.to,
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
