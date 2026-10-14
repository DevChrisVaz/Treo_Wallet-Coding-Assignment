import { ProblemError } from '@devchrisvaz/wallet-contract';
import { describe, expect, it, vi } from 'vitest';
import { createQueryClient } from './query-client';
import { queryKeys, type MovementFilters } from './query-keys';

describe('createQueryClient', () => {
  it('WEB-22 WEB-03 una lectura con 401 lleva al inicio de sesión', async () => {
    const onUnauthenticated = vi.fn();
    const client = createQueryClient({ onUnauthenticated });

    await client
      .fetchQuery({
        queryKey: queryKeys.accounts,
        queryFn: () => Promise.reject(new ProblemError(401, { code: 'UNAUTHENTICATED' })),
      })
      .catch(() => undefined);

    expect(onUnauthenticated).toHaveBeenCalledTimes(1);
  });

  it('WEB-20 otros errores de lectura no cierran la sesión', async () => {
    const onUnauthenticated = vi.fn();
    const client = createQueryClient({ onUnauthenticated });

    await client
      .fetchQuery({
        queryKey: queryKeys.beneficiaries,
        queryFn: () => Promise.reject(new ProblemError(404, { code: 'NOT_FOUND' })),
      })
      .catch(() => undefined);

    expect(onUnauthenticated).not.toHaveBeenCalled();
  });

  it('WEB-20 las lecturas no reintentan un 4xx; sí un fallo de red, hasta dos veces', () => {
    const retry = createQueryClient({ onUnauthenticated: vi.fn() }).getDefaultOptions().queries
      ?.retry as (failureCount: number, error: unknown) => boolean;
    expect(retry(0, new ProblemError(404, { code: 'NOT_FOUND' }))).toBe(false);
    expect(retry(0, new TypeError('Failed to fetch'))).toBe(true);
    expect(retry(2, new TypeError('Failed to fetch'))).toBe(false);
  });

  it('WEB-17 las mutaciones nunca se reintentan solas', () => {
    expect(
      createQueryClient({ onUnauthenticated: vi.fn() }).getDefaultOptions().mutations?.retry,
    ).toBe(0);
  });
});

describe('queryKeys', () => {
  it('WEB-14 la clave de movimientos incluye la cuenta y los filtros, bajo el prefijo "movements"', () => {
    const filters: MovementFilters = { from: '2026-10-01', to: '', types: ['DEPOSIT'] };
    expect(queryKeys.movements('abc', filters)).toEqual(['movements', 'abc', filters]);
    expect(queryKeys.allMovements).toEqual(['movements']);
    expect(queryKeys.account('abc')).toEqual(['account', 'abc']);
    expect(queryKeys.transfer('t1')).toEqual(['transfer', 't1']);
  });
});
