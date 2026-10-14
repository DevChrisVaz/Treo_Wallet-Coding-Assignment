import { toFieldErrors, type FieldError } from '@devchrisvaz/wallet-contract';
import type { ZodError } from 'zod';

/** Primer error de cada campo, por nombre (`/amount` → `amount`), para mostrarlo bajo el campo. */
export function fieldErrorsByName(errors: FieldError[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const error of errors) {
    const name = error.pointer.split('/')[1] ?? '';
    result[name] ??= error.message;
  }
  return result;
}

export function zodFieldErrors(error: ZodError): Record<string, string> {
  return fieldErrorsByName(toFieldErrors(error));
}
