import * as z from 'zod';
import type { FieldError, FieldErrorCode } from '../types';

type Issue = z.core.$ZodIssue;
export type FieldContext = z.core.$RefinementCtx<unknown>;

/** Reporta un error de campo con su código del vocabulario `FieldErrorCode` del contrato. */
export function addFieldIssue(ctx: FieldContext, fieldCode: FieldErrorCode, message: string) {
  ctx.addIssue({ code: 'custom', message, params: { fieldCode }, input: ctx.value });
}

/**
 * Campo de texto con códigos de error deterministas: `REQUIRED` si falta o está vacío,
 * `INVALID_TYPE` si no es string (por ejemplo, un número JSON) y, si es texto, las reglas de
 * `check`. Zod no reporta el valor recibido en sus errores de tipo, por eso la presencia y el tipo
 * se revisan aquí y no se deducen del mensaje.
 */
export function textField(
  requiredMessage: string,
  check: (value: string, ctx: FieldContext) => void,
) {
  return z
    .unknown()
    .superRefine((value, ctx) => {
      if (value === undefined || value === null || value === '') {
        return addFieldIssue(ctx, 'REQUIRED', requiredMessage);
      }
      if (typeof value !== 'string') return addFieldIssue(ctx, 'INVALID_TYPE', 'Debe ser texto');
      check(value, ctx);
    })
    .transform((value) => value as string);
}

function codeOf(issue: Issue): FieldErrorCode {
  switch (issue.code) {
    case 'custom': {
      const fieldCode = (issue.params as { fieldCode?: FieldErrorCode } | undefined)?.fieldCode;
      return fieldCode ?? 'INVALID_FORMAT';
    }
    case 'invalid_type':
      return issue.input === undefined ? 'REQUIRED' : 'INVALID_TYPE';
    case 'unrecognized_keys':
      return 'UNKNOWN_FIELD';
    case 'too_small':
      return 'TOO_SHORT';
    case 'too_big':
      return 'TOO_LONG';
    default:
      return 'INVALID_FORMAT';
  }
}

function toPointer(path: readonly PropertyKey[]): string {
  return path
    .map((segment) => `/${String(segment).replace(/~/g, '~0').replace(/\//g, '~1')}`)
    .join('');
}

/**
 * Convierte los errores de Zod en `FieldError` del contrato: un JSON Pointer al campo, un código
 * del vocabulario cerrado y un mensaje. Las llaves desconocidas producen un error por llave.
 */
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
