import { pino, stdTimeFunctions, type DestinationStream, type Logger } from 'pino';
import { maskClabe, maskCurp, maskEmail, maskPhone, maskRfc } from '../../shared/masking.js';
import { currentRequestContext } from '../context/request-context.js';
import type { LogLevel } from '../config/config.js';

export type { Logger } from 'pino';

/** Secretos: se reemplazan por un marcador fijo. */
const SECRET_KEYS = [
  'password',
  'accessToken',
  'refreshToken',
  'token',
  'code',
  'otp',
  'authorization',
  'cookie',
];
/** Datos personales: se enmascaran dejando visible un fragmento. */
const MASKS: Record<string, (value: string) => string> = {
  email: maskEmail,
  to: maskEmail,
  phone: maskPhone,
  curp: maskCurp,
  rfc: maskRfc,
  clabe: maskClabe,
};

export const REDACTED = '[REDACTED]';

/** Rutas de redacción hasta tres niveles de profundidad (pino no admite profundidad arbitraria). */
function redactPaths(): string[] {
  const keys = [...SECRET_KEYS, ...Object.keys(MASKS)];
  return keys.flatMap((key) => [key, `*.${key}`, `*.*.${key}`, `*.*.*.${key}`]);
}

function censor(value: unknown, path: string[]): unknown {
  const key = path[path.length - 1] ?? '';
  const mask = MASKS[key];
  if (mask && typeof value === 'string') return mask(value);
  if (mask && value === undefined) return value;
  return REDACTED;
}

/** `JSON.stringify` lanza con `bigint`: se convierten a string antes de serializar. */
function withoutBigints(value: unknown, depth = 0): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (depth > 6 || value === null || typeof value !== 'object' || value instanceof Error) {
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => withoutBigints(item, depth + 1));
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, withoutBigints(item, depth + 1)]),
  );
}

/**
 * Errores por lista blanca: tipo, mensaje, traza y, de PostgreSQL, SQLSTATE y constraint. Nunca
 * `detail` (trae los valores duplicados), ni `parameters` ni `query` de TypeORM.
 */
function serializeError(error: unknown): unknown {
  if (!(error instanceof Error)) return error;
  const source = error as Error & {
    code?: unknown;
    constraint?: unknown;
    table?: unknown;
    driverError?: { code?: unknown; constraint?: unknown; table?: unknown };
  };
  return {
    type: error.name,
    message: error.message,
    stack: error.stack,
    // `code` es una llave redactada (códigos de un solo uso): el SQLSTATE viaja como errorCode.
    errorCode: source.code ?? source.driverError?.code,
    constraint: source.constraint ?? source.driverError?.constraint,
    table: source.table ?? source.driverError?.table,
    cause: error.cause instanceof Error ? serializeError(error.cause) : undefined,
  };
}

export interface LoggerOptions {
  readonly level: LogLevel;
  /** Destino alternativo (pruebas); por defecto, stdout. */
  readonly destination?: DestinationStream;
}

/**
 * Logger JSON de la API (PLT-06): una línea por evento con nivel, hora ISO, `requestId` y usuario
 * de la petición en curso, secretos redactados y datos personales enmascarados.
 */
export function createLogger(options: LoggerOptions): Logger {
  return pino(
    {
      level: options.level,
      base: { service: 'wallet-api' },
      timestamp: stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
        log: (object) => withoutBigints(object) as Record<string, unknown>,
      },
      mixin() {
        const context = currentRequestContext();
        if (!context) return {};
        return context.userId
          ? { requestId: context.requestId, userId: context.userId }
          : { requestId: context.requestId };
      },
      serializers: { err: serializeError, error: serializeError },
      redact: { paths: redactPaths(), censor },
    },
    options.destination,
  );
}
