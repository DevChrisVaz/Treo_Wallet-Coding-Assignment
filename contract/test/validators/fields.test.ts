import { describe, expect, it } from 'vitest';
import {
  concept,
  newPassword,
  optionalReference,
  otpCode,
  phone,
  reference,
  scheduledInstant,
  toFieldErrors,
} from '../../src/index';
import {
  conceptVectors,
  otpVectors,
  phoneVectors,
  referenceVectors,
  scheduledInstantVectors,
  passwordVectors,
} from '../vectors/fields';
import type { Vector } from '../vectors/types';

const cases: [string, { safeParse: (input: unknown) => unknown }, Vector[]][] = [
  ['phone', phone, phoneVectors],
  ['concept', concept, conceptVectors],
  ['reference', reference, referenceVectors],
  ['otpCode', otpCode, otpVectors],
  ['scheduledInstant', scheduledInstant, scheduledInstantVectors],
  ['newPassword', newPassword, passwordVectors],
];

describe.each(cases)('%s', (_name, schema, vectors) => {
  it.each(vectors)('CTR-12 $input → válido: $valid ($code)', (vector) => {
    const result = schema.safeParse(vector.input) as
      { success: true } | { success: false; error: Parameters<typeof toFieldErrors>[0] };

    expect(result.success).toBe(vector.valid);
    if (!result.success) expect(toFieldErrors(result.error)[0]?.code).toBe(vector.code);
  });
});

describe('optionalReference', () => {
  it('TRF-03 acepta la referencia ausente y la cadena vacía como «sin referencia»', () => {
    expect(optionalReference.safeParse(undefined)).toMatchObject({ success: true });
    expect(optionalReference.safeParse('')).toMatchObject({ success: true, data: undefined });
  });

  it('TRF-03 si hay texto, aplica las reglas de la referencia', () => {
    expect(optionalReference.safeParse('1234567')).toMatchObject({
      success: true,
      data: '1234567',
    });
    for (const input of ['12345678', '12a', 5]) {
      expect(optionalReference.safeParse(input).success).toBe(false);
    }
  });
});
