import { ProblemError } from '@devchrisvaz/wallet-contract';
import { describe, expect, it } from 'vitest';
import { problem } from '@/test/fixtures';
import { ActionProblemError, isUncertainFailure, unwrap } from './unwrap';

describe('unwrap', () => {
  it('WEB-08 devuelve los datos de un resultado exitoso', () => {
    expect(unwrap({ ok: true, data: { id: 1 } })).toEqual({ id: 1 });
  });

  it('WEB-08 lanza un ProblemError con el code, las extensiones y el problema original', () => {
    const original = problem('INSUFFICIENT_FUNDS', {
      transferId: '4f1b0d9c-8a7f-4e6d-9c5b-0d9c8b7a6f5e',
    });
    let error: unknown;
    try {
      unwrap({ ok: false, problem: original });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(ProblemError);
    expect(error).toBeInstanceOf(ActionProblemError);
    expect(error).toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
      status: 422,
      transferId: '4f1b0d9c-8a7f-4e6d-9c5b-0d9c8b7a6f5e',
      requestId: '01JABC',
    });
    expect((error as ActionProblemError).problem).toEqual(original);
  });

  it('WEB-12 conserva retryAfter', () => {
    let error: unknown;
    try {
      unwrap({ ok: false, problem: problem('RATE_LIMITED', { status: 429, retryAfter: 60 }) });
    } catch (caught) {
      error = caught;
    }
    expect((error as ActionProblemError).retryAfter).toBe(60);
  });
});

describe('isUncertainFailure', () => {
  it('WEB-17 un fallo de red o un 5xx no dicen si la operación se hizo: se reintenta con la misma llave', () => {
    expect(isUncertainFailure(new TypeError('Failed to fetch'))).toBe(true);
    expect(
      isUncertainFailure(new ActionProblemError(problem('INTERNAL_ERROR', { status: 503 }))),
    ).toBe(true);
  });

  it('WEB-17 un rechazo 4xx es una respuesta definitiva', () => {
    expect(isUncertainFailure(new ActionProblemError(problem('INSUFFICIENT_FUNDS')))).toBe(false);
    expect(
      isUncertainFailure(new ActionProblemError(problem('UNAUTHENTICATED', { status: 401 }))),
    ).toBe(false);
  });
});
