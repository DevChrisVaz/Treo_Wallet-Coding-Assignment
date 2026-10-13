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

/** Convierte a mayúsculas lo que se escribe (CURP, RFC) antes de que el formulario lo lea. */
export function upperCase<T extends string>(
  registration: UseFormRegisterReturn<T>,
): UseFormRegisterReturn<T> {
  return {
    ...registration,
    onChange: (event) => {
      const input = event.target as HTMLInputElement;
      input.value = input.value.toUpperCase();
      return registration.onChange(event);
    },
  };
}
