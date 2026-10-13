import { describe, expect, it } from 'vitest';
import { rfc, toFieldErrors } from '../../src/index';
import { rfcVectors } from '../vectors/identity';

describe('rfc', () => {
  it.each(rfcVectors)('CTR-11 $input → válido: $valid ($code)', (vector) => {
    const result = rfc.safeParse(vector.input);

    expect(result.success).toBe(vector.valid);
    if (!result.success) expect(toFieldErrors(result.error)[0]?.code).toBe(vector.code);
  });
});
