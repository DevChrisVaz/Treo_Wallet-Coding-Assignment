import { describe, expect, it } from 'vitest';
import { bigintTransformer } from '../../../src/platform/persistence/bigint-transformer.js';

describe('PLT-15 transformer de BIGINT', () => {
  it('PLT-15 convierte el string de int8 a bigint sin pasar por Number', () => {
    // 2^53 + 1 no es representable como Number: con Number(...) se convertiría en 2^53.
    expect(bigintTransformer.from('9007199254740993')).toBe(9007199254740993n);
    expect(bigintTransformer.from('-125050')).toBe(-125050n);
    expect(bigintTransformer.from('0')).toBe(0n);
  });

  it('PLT-15 convierte bigint a string para escribirlo', () => {
    expect(bigintTransformer.to(9007199254740993n)).toBe('9007199254740993');
    expect(bigintTransformer.to(-1n)).toBe('-1');
  });

  it('PLT-15 conserva los nulos', () => {
    expect(bigintTransformer.from(null)).toBeNull();
    expect(bigintTransformer.to(null)).toBeNull();
  });

  it('PLT-15 rechaza números de JavaScript para no perder precisión en silencio', () => {
    expect(() => bigintTransformer.from(12.5 as unknown as string)).toThrow(TypeError);
    expect(() => bigintTransformer.to(10 as unknown as bigint)).toThrow(TypeError);
  });
});
