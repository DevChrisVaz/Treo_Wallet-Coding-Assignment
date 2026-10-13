import type { FieldError, FieldErrorCode } from '@devchrisvaz/wallet-contract';
import * as z from 'zod';
import { normalizeEmail } from '../../shared/email.js';
import { DomainError } from '../../shared/errors.js';

export type FieldContext = z.core.$RefinementCtx<unknown>;

/** Reporta un error de campo con su código del vocabulario `FieldErrorCode` del contrato. */
export function addFieldIssue(ctx: FieldContext, fieldCode: FieldErrorCode, message: string): void {
  ctx.addIssue({ code: 'custom', message, params: { fieldCode } });
}

/** Longitud en puntos de código, igual que `minLength`/`maxLength` de JSON Schema. */
export function codePointLength(value: string): number {
  return [...value].length;
}

/**
 * Campo de texto con errores deterministas. Zod 4 no incluye el valor recibido en sus errores de
 * tipo, así que la presencia (`REQUIRED`) y el tipo (`INVALID_TYPE`, por ejemplo un número JSON)
 * se revisan aquí explícitamente; después se aplican longitud y `check`.
 */
export function textField(
  options: {
    readonly min?: number;
    readonly max?: number;
    readonly check?: (value: string, ctx: FieldContext) => void;
  } = {},
) {
  return z
    .unknown()
    .superRefine((value, ctx) => {
      if (value === undefined || value === null) {
        return addFieldIssue(ctx, 'REQUIRED', 'Este campo es obligatorio');
      }
      if (typeof value !== 'string') return addFieldIssue(ctx, 'INVALID_TYPE', 'Debe ser texto');
      const length = codePointLength(value);
      if (options.min !== undefined && length < options.min) {
        return addFieldIssue(
          ctx,
          length === 0 ? 'REQUIRED' : 'TOO_SHORT',
          length === 0
            ? 'Este campo es obligatorio'
            : `Debe tener al menos ${options.min} caracteres`,
        );
      }
      if (options.max !== undefined && length > options.max) {
        return addFieldIssue(ctx, 'TOO_LONG', `Admite máximo ${options.max} caracteres`);
      }
      options.check?.(value, ctx);
    })
    .transform((value) => value as string);
}

/** Mismo patrón que el formato `email` de ajv-formats, para aceptar lo mismo que el contrato. */
const EMAIL =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;

/** Email normalizado, de hasta 254 caracteres. */
export function emailField() {
  return textField({
    check: (value, ctx) => {
      const email = normalizeEmail(value);
      if (email === '') return addFieldIssue(ctx, 'REQUIRED', 'El email es obligatorio');
      if (email.length > 254) return addFieldIssue(ctx, 'TOO_LONG', 'El email es demasiado largo');
      if (!EMAIL.test(email)) addFieldIssue(ctx, 'INVALID_FORMAT', 'El email no es válido');
    },
  }).transform(normalizeEmail);
}

function toPointer(path: readonly PropertyKey[]): string {
  return path
    .map((segment) => `/${String(segment).replace(/~/g, '~0').replace(/\//g, '~1')}`)
    .join('');
}

function codeOf(issue: z.core.$ZodIssue): FieldErrorCode {
  switch (issue.code) {
    case 'custom':
      return (
        (issue.params as { fieldCode?: FieldErrorCode } | undefined)?.fieldCode ?? 'INVALID_FORMAT'
      );
    // Solo ocurre en la raíz (cuerpo que no es objeto): los campos usan `textField` u otros
    // validadores que revisan presencia y tipo explícitamente.
    case 'invalid_type':
      return 'INVALID_TYPE';
    case 'too_small':
      return 'TOO_SHORT';
    case 'too_big':
      return 'TOO_LONG';
    default:
      return 'INVALID_FORMAT';
  }
}

/** Errores de Zod a `FieldError[]` del contrato: JSON Pointer, código y mensaje (PLT-02). */
export function toFieldErrors(error: z.ZodError): FieldError[] {
  return error.issues.flatMap((issue) => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({
        pointer: toPointer([...issue.path, key]),
        code: 'UNKNOWN_FIELD' as const,
        message: 'Campo no permitido',
      }));
    }
    return [{ pointer: toPointer(issue.path), code: codeOf(issue), message: issue.message }];
  });
}

/** Valida y transforma una entrada; si no cumple, lanza `422 VALIDATION_FAILED`. */
export function parseInput<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new DomainError('VALIDATION_FAILED', 'Revisa los campos marcados', {
      errors: toFieldErrors(result.error),
    });
  }
  return result.data;
}

/**
 * Valida el cuerpo JSON de una petición antes de cualquier lógica de negocio (PLT-02). Un cuerpo
 * ausente o que no es JSON responde `400 MALFORMED_REQUEST`.
 */
export function parseBody<S extends z.ZodType>(schema: S, body: unknown): z.output<S> {
  if (body === undefined) {
    throw new DomainError('MALFORMED_REQUEST', 'Se esperaba un cuerpo JSON');
  }
  return parseInput(schema, body);
}
