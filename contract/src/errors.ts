import { PROBLEM_CODES, type FieldError, type ProblemCode, type TransferStatus } from './types';

const KNOWN_CODES: ReadonlySet<string> = new Set(PROBLEM_CODES);

/**
 * Error devuelto por la API (o por un intermediario) con respuesta HTTP. `code` siempre es un
 * `ProblemCode` conocido: un código más nuevo que el paquete se reporta como `INTERNAL_ERROR` y se
 * conserva en `rawCode`, para que los `switch` exhaustivos de los clientes sigan siendo válidos.
 */
export class ProblemError extends Error {
  override readonly name = 'ProblemError';
  readonly status: number;
  readonly code: ProblemCode;
  readonly rawCode: string;
  readonly title: string;
  readonly detail: string | undefined;
  readonly type: string | undefined;
  readonly instance: string | undefined;
  readonly requestId: string | undefined;
  readonly errors: FieldError[] | undefined;
  readonly transferId: string | undefined;
  readonly transferStatus: TransferStatus | undefined;
  readonly remaining: string | undefined;
  readonly attemptsRemaining: number | undefined;

  constructor(status: number, body: Record<string, unknown>, fallbackRequestId?: string | null) {
    const title = typeof body.title === 'string' ? body.title : 'Error de la API';
    super(title);
    const rawCode = typeof body.code === 'string' ? body.code : 'INTERNAL_ERROR';
    this.status = status;
    this.rawCode = rawCode;
    this.code = KNOWN_CODES.has(rawCode) ? (rawCode as ProblemCode) : 'INTERNAL_ERROR';
    this.title = title;
    this.detail = stringOrUndefined(body.detail);
    this.type = stringOrUndefined(body.type);
    this.instance = stringOrUndefined(body.instance);
    this.requestId = stringOrUndefined(body.requestId) ?? fallbackRequestId ?? undefined;
    this.errors = Array.isArray(body.errors) ? (body.errors as FieldError[]) : undefined;
    this.transferId = stringOrUndefined(body.transferId);
    this.transferStatus = stringOrUndefined(body.transferStatus) as TransferStatus | undefined;
    this.remaining = stringOrUndefined(body.remaining);
    this.attemptsRemaining =
      typeof body.attemptsRemaining === 'number' ? body.attemptsRemaining : undefined;
  }
}

/** La petición no obtuvo respuesta HTTP (red caída, timeout). Es la única condición reintentable. */
export class NetworkError extends Error {
  override readonly name = 'NetworkError';

  constructor(cause: unknown) {
    super('No se obtuvo respuesta de la API', { cause });
  }
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Convierte una respuesta no exitosa en `ProblemError`. Si no es `application/problem+json`
 * (por ejemplo, un 502 en HTML de un proxy), el cuerpo se descarta para no exponerlo.
 */
export async function toProblemError(response: Response): Promise<ProblemError> {
  const requestId = response.headers.get('X-Request-Id');
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/problem+json')) {
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object') {
        return new ProblemError(response.status, body as Record<string, unknown>, requestId);
      }
    } catch {
      // Cuerpo ilegible: se trata igual que una respuesta que no es problem+json.
    }
  }
  return new ProblemError(
    response.status,
    { code: 'INTERNAL_ERROR', title: 'Error inesperado' },
    requestId,
  );
}
