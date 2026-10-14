import { ProblemError } from '@devchrisvaz/wallet-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OVERVIEW } from '@/test/fixtures';
import { bffGet } from './bff';

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('bffGet', () => {
  it('WEB-09 lee por GET del proxy del BFF y devuelve el JSON', async () => {
    fetchMock.mockResolvedValue(Response.json(OVERVIEW));

    expect(await bffGet('accounts')).toEqual(OVERVIEW);

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/bff/api/accounts');
    expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin', cache: 'no-store' });
  });

  it('WEB-14 envía los filtros como parámetros de consulta, con varios tipos', async () => {
    fetchMock.mockResolvedValue(Response.json({ items: [], nextCursor: null }));

    await bffGet('accounts/abc/movements', {
      from: '2026-10-01',
      type: ['DEPOSIT', 'TRANSFER_IN'],
      cursor: undefined,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/bff/api/accounts/abc/movements?from=2026-10-01&type=DEPOSIT&type=TRANSFER_IN',
    );
  });

  it('WEB-19 una respuesta de error llega como ProblemError con su code y requestId', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          type: 'x',
          title: 't',
          status: 400,
          code: 'INVALID_CURSOR',
          requestId: 'r1',
        }),
        { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );

    const error = await bffGet('accounts').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProblemError);
    expect(error).toMatchObject({ status: 400, code: 'INVALID_CURSOR', requestId: 'r1' });
  });

  it('WEB-20 un fallo de red se propaga como error sin respuesta', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const error = await bffGet('accounts').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(TypeError);
  });
});
