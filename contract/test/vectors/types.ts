import type { FieldErrorCode } from '../../src/types';

/**
 * Un caso de prueba de un validador.
 * - `valid`: lo que debe responder el validador del paquete.
 * - `code`: el código de error por campo esperado cuando `valid` es `false`.
 * - `contractValid`: lo que responde el esquema de `openapi.yaml`. Por defecto es igual a `valid`;
 *   difiere solo cuando el error está fuera del alcance del patrón (dígito verificador, fecha).
 */
export interface Vector {
  input: unknown;
  valid: boolean;
  code?: FieldErrorCode;
  contractValid?: boolean;
  note?: string;
}

export interface AmountVector extends Vector {
  /** Centavos esperados para los montos válidos. */
  cents?: bigint;
}

export function contractExpectation(vector: Vector): boolean {
  return vector.contractValid ?? vector.valid;
}
