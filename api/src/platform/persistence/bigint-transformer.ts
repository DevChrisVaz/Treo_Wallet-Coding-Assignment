import type { ValueTransformer } from 'typeorm';

/**
 * Columna `BIGINT` ⇄ `bigint`. El driver `pg` entrega `int8` como string; aquí se convierte con
 * `BigInt(...)` y nunca con `Number(...)`, que perdería precisión por encima de 2^53. Un `number`
 * de JavaScript se rechaza para no aceptar en silencio un valor que ya pudo perder precisión.
 */
export const bigintTransformer: ValueTransformer & {
  to(value: bigint | null | undefined): string | null;
  from(value: string | null): bigint | null;
} = {
  to(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== 'bigint')
      throw new TypeError('Se esperaba un bigint para una columna BIGINT');
    return value.toString();
  },
  from(value) {
    if (value === null) return null;
    if (typeof value !== 'string') throw new TypeError('Se esperaba el string de int8 del driver');
    return BigInt(value);
  },
};
