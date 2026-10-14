/**
 * Mensajes para la persona usuaria (MOB-14, DSG-12). Se deciden solo por el `code` del problema
 * RFC 9457, nunca por `type`, `title` ni `detail`; el texto base sale del paquete de diseño y la app
 * agrega los datos variables (lo que queda del límite, intentos, folio para soporte).
 */
import {
  formatMXN,
  NetworkError,
  ProblemError,
  type ProblemCode,
} from '@devchrisvaz/wallet-contract';
import { problemMessage, problemMessages } from '@devchrisvaz/wallet-design-tokens';

// El paquete de diseño debe tener un mensaje para cada code del contrato.
problemMessages satisfies Record<ProblemCode, string>;

export const NETWORK_ERROR_MESSAGE =
  'No pudimos conectar con TreoWallet. Revisa tu conexión e intenta de nuevo.';

function attemptsText(attempts: number | undefined): string {
  if (attempts === undefined) return '';
  return attempts === 1 ? ' Te queda 1 intento.' : ` Te quedan ${attempts} intentos.`;
}

function problemText(error: ProblemError): string {
  const base = problemMessage(error.code);
  const code: ProblemCode = error.code;
  switch (code) {
    case 'DAILY_LIMIT_EXCEEDED':
      return error.remaining ? `${base} Hoy te quedan ${formatMXN(error.remaining)}.` : base;
    case 'OTP_INVALID':
    case 'VERIFICATION_CODE_INVALID':
      return `${base}${attemptsText(error.attemptsRemaining)}`;
    case 'INTERNAL_ERROR':
      return error.requestId ? `${base} Folio para soporte: ${error.requestId}.` : base;
    case 'MALFORMED_REQUEST':
    case 'IDEMPOTENCY_KEY_MISSING':
    case 'IDEMPOTENCY_KEY_INVALID':
    case 'INVALID_CURSOR':
    case 'UNAUTHENTICATED':
    case 'INVALID_CREDENTIALS':
    case 'SESSION_REVOKED':
    case 'EMAIL_NOT_VERIFIED':
    case 'NOT_FOUND':
    case 'BENEFICIARY_CONFLICT':
    case 'TRANSFER_NOT_PENDING':
    case 'TRANSFER_EXPIRED':
    case 'TRANSFER_NOT_CANCELLABLE':
    case 'VALIDATION_FAILED':
    case 'INSUFFICIENT_FUNDS':
    case 'SAME_ACCOUNT_TRANSFER':
    case 'IDEMPOTENCY_KEY_REUSED':
    case 'CLABE_INVALID':
    case 'CLABE_NOT_IN_PLATFORM':
    case 'BENEFICIARY_IS_OWN_ACCOUNT':
    case 'OTP_ATTEMPTS_EXHAUSTED':
    case 'RESEND_LIMIT_REACHED':
    case 'SCHEDULED_LIMIT_REACHED':
    case 'RATE_LIMITED':
      return base;
    default: {
      // Si el contrato agrega un code, TypeScript marca este punto hasta que se decida su mensaje.
      const unhandled: never = code;
      return unhandled;
    }
  }
}

/** Mensaje para cualquier error que llegue a una pantalla. */
export function errorMessage(error: unknown): string {
  if (error instanceof ProblemError) return problemText(error);
  if (error instanceof NetworkError) return NETWORK_ERROR_MESSAGE;
  return problemMessage('INTERNAL_ERROR');
}
