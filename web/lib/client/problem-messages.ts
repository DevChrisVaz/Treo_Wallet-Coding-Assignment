import { formatMXN, ProblemError, type ProblemCode } from '@devchrisvaz/wallet-contract';
import { problemMessage, problemMessages } from '@devchrisvaz/wallet-design-tokens';

/*
 * Mensajes por `code` (D9 de web-app, WEB-19). El texto base sale de `problemMessage` del paquete
 * de diseño (DSG-12) y la web agrega los datos variables de las extensiones. El paquete no depende
 * del contrato: esta comprobación hace fallar el typecheck si el contrato agrega un código sin
 * mensaje.
 */
problemMessages satisfies Record<ProblemCode, string>;

/** Mensaje si la Server Action no obtuvo respuesta del servidor de la web. */
export const CONNECTION_ERROR =
  'No pudimos conectar con TreoWallet. Revisa tu conexión e intenta de nuevo.';

/** Campos del problema que usan los mensajes (`ActionProblem` o `ProblemError`). */
export interface ProblemLike {
  code: ProblemCode;
  requestId?: string | undefined;
  attemptsRemaining?: number | undefined;
  remaining?: string | undefined;
  retryAfter?: number | undefined;
}

function minutes(count: number): string {
  return count === 1 ? '1 minuto' : `${count} minutos`;
}

/** "Te quedan 2 intentos." / "Te queda 1 intento." (WEB-11, WEB-18). */
export function attempts(count: number): string {
  if (count <= 0) return 'Ya no te quedan intentos.';
  return count === 1 ? 'Te queda 1 intento.' : `Te quedan ${count} intentos.`;
}

function detailFor(problem: ProblemLike): string | null {
  switch (problem.code) {
    case 'OTP_INVALID':
    case 'VERIFICATION_CODE_INVALID':
      return problem.attemptsRemaining === undefined ? null : attempts(problem.attemptsRemaining);
    case 'RATE_LIMITED':
      // Segundos a minutos enteros hacia arriba: nunca se indica esperar menos de lo pedido.
      return problem.retryAfter === undefined
        ? null
        : `Intenta de nuevo en ${minutes(Math.max(1, Math.ceil(problem.retryAfter / 60)))}.`;
    case 'DAILY_LIMIT_EXCEEDED':
      return problem.remaining === undefined
        ? null
        : `Hoy puedes enviar hasta ${formatMXN(problem.remaining)}.`;
    case 'INTERNAL_ERROR':
      return problem.requestId
        ? `Si contactas a soporte, menciona el código ${problem.requestId}.`
        : null;
    default:
      return null;
  }
}

/** Mensaje para la persona usuaria según el `code` del problema y sus extensiones. */
export function describeProblem(problem: ProblemLike): string {
  const base = problemMessage(problem.code);
  const detail = detailFor(problem);
  return detail ? `${base} ${detail}` : base;
}

/** Mensaje para cualquier error de una lectura o una mutación. */
export function describeError(error: unknown): string {
  return error instanceof ProblemError ? describeProblem(error) : CONNECTION_ERROR;
}
