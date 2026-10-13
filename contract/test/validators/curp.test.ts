import { describe, expect, it } from 'vitest';
import { curp, curpCheckDigit, isValidCalendarDate, toFieldErrors } from '../../src/index';
import { curpVectors } from '../vectors/identity';

describe('curpCheckDigit', () => {
  it.each([
    ['GOMC900101HDFNLR0', 9],
    ['GOMC040229MDFNLRA', 0],
    ['GOMC990231HDFNLR0', 1],
  ])('CTR-10 %s → %i', (first17, expected) => {
    expect(curpCheckDigit(first17)).toBe(expected);
  });
});

describe('isValidCalendarDate', () => {
  it.each([
    [2004, 2, 29, true],
    [2000, 2, 29, true],
    [2005, 2, 29, false],
    [1900, 2, 29, false],
    [1999, 2, 31, false],
    [1990, 4, 31, false],
    [1990, 12, 31, true],
  ])('CTR-10 %i-%i-%i → %s', (year, month, day, expected) => {
    expect(isValidCalendarDate(year, month, day)).toBe(expected);
  });
});

describe('curp', () => {
  it.each(curpVectors)('CTR-10 $input → válido: $valid ($code)', (vector) => {
    const result = curp.safeParse(vector.input);

    expect(result.success).toBe(vector.valid);
    if (!result.success) expect(toFieldErrors(result.error)[0]?.code).toBe(vector.code);
  });
});
