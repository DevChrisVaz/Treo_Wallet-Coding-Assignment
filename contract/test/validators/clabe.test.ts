import { describe, expect, it } from 'vitest';
import { clabe, clabeCheckDigit, toFieldErrors } from '../../src/index';
import { clabeVectors } from '../vectors/identity';

describe('clabeCheckDigit', () => {
  it('CTR-09 calcula 9 para 03218000011835971 (A = 1)', () => {
    expect(clabeCheckDigit('03218000011835971')).toBe(9);
  });

  it('CTR-09 calcula 0, no 10, cuando A = 0', () => {
    expect(clabeCheckDigit('03218000011835978')).toBe(0);
  });
});

describe('clabe', () => {
  it.each(clabeVectors)('CTR-09 $input → válido: $valid ($code)', (vector) => {
    const result = clabe.safeParse(vector.input);

    expect(result.success).toBe(vector.valid);
    if (!result.success) expect(toFieldErrors(result.error)[0]?.code).toBe(vector.code);
  });

  it('CTR-09 conserva los ceros a la izquierda', () => {
    expect(clabe.parse('032180000118359719')).toBe('032180000118359719');
  });
});
