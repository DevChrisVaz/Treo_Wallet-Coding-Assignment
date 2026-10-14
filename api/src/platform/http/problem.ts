import type { Problem, ProblemCode } from '@devchrisvaz/wallet-contract';
import type { DomainError, ProblemExtensions } from '../../shared/errors.js';

interface ProblemEntry {
  readonly status: number;
  readonly title: string;
}

/** Status y título (en español) de cada código del catálogo `ProblemCode` del contrato (PLT-01). */
export const PROBLEM_CATALOG: Record<ProblemCode, ProblemEntry> = {
  MALFORMED_REQUEST: { status: 400, title: 'Petición mal formada' },
  IDEMPOTENCY_KEY_MISSING: { status: 400, title: 'Falta la llave de idempotencia' },
  IDEMPOTENCY_KEY_INVALID: { status: 400, title: 'Llave de idempotencia inválida' },
  INVALID_CURSOR: { status: 400, title: 'Cursor de paginación inválido' },
  UNAUTHENTICATED: { status: 401, title: 'Autenticación requerida' },
  INVALID_CREDENTIALS: { status: 401, title: 'Credenciales inválidas' },
  SESSION_REVOKED: { status: 401, title: 'Sesión revocada o vencida' },
  EMAIL_NOT_VERIFIED: { status: 403, title: 'Correo sin verificar' },
  NOT_FOUND: { status: 404, title: 'Recurso no encontrado' },
  BENEFICIARY_CONFLICT: { status: 409, title: 'El beneficiario choca con uno existente' },
  TRANSFER_NOT_PENDING: { status: 409, title: 'La transferencia no está pendiente' },
  TRANSFER_EXPIRED: { status: 409, title: 'La transferencia venció' },
  TRANSFER_NOT_CANCELLABLE: { status: 409, title: 'La transferencia ya no se puede cancelar' },
  VALIDATION_FAILED: { status: 422, title: 'Datos inválidos' },
  INSUFFICIENT_FUNDS: { status: 422, title: 'Saldo insuficiente' },
  DAILY_LIMIT_EXCEEDED: { status: 422, title: 'Límite diario excedido' },
  SAME_ACCOUNT_TRANSFER: { status: 422, title: 'El origen y el destino son la misma cuenta' },
  IDEMPOTENCY_KEY_REUSED: { status: 422, title: 'Llave de idempotencia usada con otros datos' },
  CLABE_INVALID: { status: 422, title: 'CLABE inválida' },
  CLABE_NOT_IN_PLATFORM: { status: 422, title: 'La CLABE no pertenece a la plataforma' },
  BENEFICIARY_IS_OWN_ACCOUNT: { status: 422, title: 'La CLABE es de una cuenta propia' },
  OTP_INVALID: { status: 422, title: 'Código de confirmación incorrecto' },
  OTP_ATTEMPTS_EXHAUSTED: { status: 422, title: 'Se agotaron los intentos del código' },
  RESEND_LIMIT_REACHED: { status: 422, title: 'Se alcanzó el máximo de reenvíos' },
  SCHEDULED_LIMIT_REACHED: { status: 422, title: 'Se alcanzó el máximo de programadas' },
  VERIFICATION_CODE_INVALID: { status: 422, title: 'Código de verificación inválido' },
  RATE_LIMITED: { status: 429, title: 'Demasiadas peticiones' },
  INTERNAL_ERROR: { status: 500, title: 'Error interno' },
};

/** Qué extensiones admite cada código, según la descripción de `Problem` en el contrato. */
const ALLOWED_EXTENSIONS: Record<keyof ProblemExtensions, readonly ProblemCode[]> = {
  errors: ['VALIDATION_FAILED'],
  transferId: ['INSUFFICIENT_FUNDS', 'DAILY_LIMIT_EXCEEDED', 'OTP_ATTEMPTS_EXHAUSTED'],
  transferStatus: ['TRANSFER_NOT_PENDING', 'TRANSFER_NOT_CANCELLABLE'],
  remaining: ['DAILY_LIMIT_EXCEEDED'],
  attemptsRemaining: ['OTP_INVALID', 'VERIFICATION_CODE_INVALID'],
};

function kebab(code: string): string {
  return code.toLowerCase().replace(/_/g, '-');
}

export function statusOf(code: ProblemCode): number {
  return PROBLEM_CATALOG[code].status;
}

/** Construye el cuerpo RFC 9457 de un error de dominio, solo con las extensiones permitidas. */
export function toProblem(
  error: Pick<DomainError, 'code' | 'detail' | 'extensions'>,
  context: { readonly requestId: string; readonly instance?: string },
): Problem {
  const entry = PROBLEM_CATALOG[error.code];
  const problem: Problem = {
    type: `/problems/${kebab(error.code)}`,
    title: entry.title,
    status: entry.status,
    code: error.code,
    requestId: context.requestId,
  };
  if (error.detail !== undefined) problem.detail = error.detail;
  if (context.instance !== undefined) problem.instance = context.instance;
  for (const [key, codes] of Object.entries(ALLOWED_EXTENSIONS)) {
    const value = error.extensions[key as keyof ProblemExtensions];
    if (value !== undefined && codes.includes(error.code)) {
      (problem as Record<string, unknown>)[key] = value;
    }
  }
  return problem;
}
