import { DomainError } from '../../shared/errors.js';
import type { AppLogger } from '../../shared/logger.js';

export interface PgErrorInfo {
  readonly code: string;
  readonly constraint?: string;
}

function asPgError(value: unknown): PgErrorInfo | undefined {
  if (typeof value !== 'object' || value === null) return undefined;
  const { code, constraint } = value as { code?: unknown; constraint?: unknown };
  // SQLSTATE: 5 caracteres alfanuméricos en mayúsculas.
  if (typeof code !== 'string' || !/^[0-9A-Z]{5}$/.test(code)) return undefined;
  return typeof constraint === 'string' ? { code, constraint } : { code };
}

/** SQLSTATE y constraint de un error del driver pg o de un `QueryFailedError` de TypeORM. */
export function pgErrorOf(error: unknown): PgErrorInfo | undefined {
  return asPgError(error) ?? asPgError((error as { driverError?: unknown } | null)?.driverError);
}

/** ¿Es una violación de unicidad de alguna de estas constraints? */
export function isUniqueViolation(error: unknown, constraints: readonly string[]): boolean {
  const info = pgErrorOf(error);
  return info?.code === '23505' && constraints.includes(info.constraint ?? '');
}

interface Translation {
  readonly toError: () => DomainError;
  /** Nivel de log cuando actúa: `error` si significa que una validación del servicio falló. */
  readonly logLevel?: 'warn' | 'error';
}

/** Interbloqueo, serialización y permiso denegado: indican un error de diseño u operación. */
const ALERT_STATES = new Set(['40P01', '40001', '42501']);

/**
 * Traduce errores de PostgreSQL a errores de dominio usando únicamente el nombre de la constraint,
 * nunca el texto del mensaje (PLT-04). Cada módulo registra las suyas al componerse.
 */
export class PgErrorTranslator {
  private readonly translations = new Map<string, Translation>();

  constructor(private readonly logger: AppLogger) {}

  register(
    constraint: string,
    toError: () => DomainError,
    options: { logLevel?: 'warn' | 'error' } = {},
  ): void {
    if (this.translations.has(constraint)) {
      throw new Error(`Ya existe una traducción para ${constraint}`);
    }
    this.translations.set(constraint, { toError, ...options });
  }

  /** Devuelve el error de dominio, o `undefined` si no es un error que este traductor maneje. */
  translate = (error: unknown): DomainError | undefined => {
    const info = pgErrorOf(error);
    if (!info) return undefined;
    if (ALERT_STATES.has(info.code)) {
      this.logger.error({ err: error, sqlState: info.code, alert: true }, 'database alert');
      return new DomainError('INTERNAL_ERROR');
    }
    if (!info.code.startsWith('23')) return undefined;
    const translation = info.constraint ? this.translations.get(info.constraint) : undefined;
    if (!translation) {
      this.logger.error(
        { err: error, sqlState: info.code, constraint: info.constraint },
        'untranslated integrity violation',
      );
      return new DomainError('INTERNAL_ERROR');
    }
    if (translation.logLevel) {
      this.logger[translation.logLevel](
        { sqlState: info.code, constraint: info.constraint },
        'database constraint enforced',
      );
    }
    return translation.toError();
  };
}
