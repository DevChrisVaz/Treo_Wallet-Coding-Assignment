import { describe, expect, it } from 'vitest';
import { PROBLEM_CODES } from '../src/index';
import { contractEnum } from './support/contract';

describe('PROBLEM_CODES', () => {
  it('CTR-07 contiene exactamente los códigos de ProblemCode del contrato', () => {
    expect([...PROBLEM_CODES].sort()).toEqual([...contractEnum('ProblemCode')].sort());
  });
});
