import { ProblemError } from '@devchrisvaz/wallet-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OVERVIEW } from '@/test/fixtures';
import { bffDownload, bffGet } from './bff';

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

describe('bffDownload', () => {
  const PATH = 'accounts/7b1f0a52-3c1e-4d8e-9a55-2f7d1c3b9e10/statements/2026-09';

  it('WEB-32 descarga por el proxy del BFF y toma el nombre del archivo de Content-Disposition', async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0xff]), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="estado-de-cuenta-2026-09-0015.pdf"',
        },
      }),
    );

    const file = await bffDownload(PATH);

    expect(file.filename).toBe('estado-de-cuenta-2026-09-0015.pdf');
    expect(file.blob.type).toBe('application/pdf');
    expect(new Uint8Array(await file.blob.arrayBuffer())).toEqual(
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0xff]),
    );
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(`/bff/api/${PATH}`);
    expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin', cache: 'no-store' });
    expect(new Headers(init?.headers).get('accept')).toBe(
      'application/pdf, application/problem+json',
    );
  });

  it('WEB-32 sin Content-Disposition usa el último segmento de la ruta como nombre', async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'application/pdf' } }),
    );
    expect((await bffDownload(PATH)).filename).toBe('2026-09.pdf');
  });

  it('WEB-32 un error llega como ProblemError con su code y la espera de Retry-After', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ title: 't', status: 429, code: 'RATE_LIMITED', requestId: 'r2' }),
        {
          status: 429,
          headers: { 'Content-Type': 'application/problem+json', 'Retry-After': '60' },
        },
      ),
    );
    const error = await bffDownload(PATH).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ProblemError);
    expect(error).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfter: 60 });
  });
});
