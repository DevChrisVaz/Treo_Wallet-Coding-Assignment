import { digitsOnly, uppercaseAlphanumeric } from '@devchrisvaz/wallet-contract';
import type { FieldValues, Path, UseFormRegisterReturn, UseFormSetError } from 'react-hook-form';
import type { ActionProblem } from '@/lib/action-result';

/**
 * Lleva a sus campos los errores de `VALIDATION_FAILED` que devolvió el servidor (JSON Pointer de un
 * nivel, como `/curp`). Devuelve `true` si marcó al menos un campo.
 */
export function applyServerFieldErrors<T extends FieldValues>(
  problem: ActionProblem,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  let applied = false;
  for (const error of problem.errors ?? []) {
    const field = fields.find((name) => `/${name}` === error.pointer);
    if (field) {
      setError(field, { type: 'server', message: error.message }, { shouldFocus: !applied });
      applied = true;
    }
  }
  return applied;
}

/** Cambia el texto del campo con `clean` antes de que el formulario lo lea (también al pegar). */
function sanitizing<T extends string>(
  registration: UseFormRegisterReturn<T>,
  clean: (raw: string) => string,
): UseFormRegisterReturn<T> {
  return {
    ...registration,
    onChange: (event) => {
      const input = event.target as HTMLInputElement;
      const cleaned = clean(input.value);
      if (cleaned !== input.value) input.value = cleaned;
      return registration.onChange(event);
    },
  };
}

/** CURP y RFC mientras se escriben: mayúsculas alfanuméricas, recortadas a `maxLength` (WEB-11). */
export function uppercaseField<T extends string>(
  registration: UseFormRegisterReturn<T>,
  maxLength: number,
): UseFormRegisterReturn<T> {
  return sanitizing(registration, (raw) => uppercaseAlphanumeric(raw, maxLength));
}

/** Teléfono, referencia y códigos: solo dígitos, recortados a `maxLength` (WEB-11, WEB-16, WEB-18). */
export function digitsOnlyField<T extends string>(
  registration: UseFormRegisterReturn<T>,
  maxLength: number,
): UseFormRegisterReturn<T> {
  return sanitizing(registration, (raw) => digitsOnly(raw, maxLength));
}
