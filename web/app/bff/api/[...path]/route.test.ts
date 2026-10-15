import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionStore } from '@/lib/server/session-store';
import { OVERVIEW, PRINCIPAL, transfer } from '@/test/fixtures';
import { fakeApi, jsonResponse, problemResponse } from '@/test/support/fake-api';
import { cookieValue, resetRequest } from '@/test/support/next-headers';
import { SESSION_ID, sessionData } from '@/test/support/session';
import { DELETE, GET, PATCH, POST, PUT } from './route';

vi.mock('next/headers', () => import('@/test/support/next-headers'));

const BROWSER = { 'x-request-id': 'bff-123', 'x-forwarded-for': '203.0.113.7' };

function get(path: string[], query = '', headers: Record<string, string> = BROWSER) {
  const request = new Request(`http://localhost:3000/bff/api/${path.join('/')}${query}`, {
    headers,
  });
  return GET(request, { params: Promise.resolve({ path }) });
}

beforeEach(async () => {
  await sessionStore().delete(SESSION_ID);
  await sessionStore().set(SESSION_ID, sessionData());
  resetRequest({ headers: BROWSER, cookies: { sid: SESSION_ID } });
});

describe('GET /bff/api/[...path]', () => {
  it('WEB-09 reenvía los movimientos de una cuenta con sus parámetros de consulta', async () => {
    const page = { items: [], nextCursor: null };
    const api = fakeApi().on('GET', `/accounts/${PRINCIPAL.id}/movements`, () =>
      jsonResponse(200, page),
    );

    const response = await get(
      ['accounts', PRINCIPAL.id, 'movements'],
      '?type=DEPOSIT&type=TRANSFER_IN&from=2026-10-01&cursor=abc',
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(page);
    const [call] = api.calls;
    expect(call?.url.origin).toBe('http://localhost:4000');
    expect(call?.url.searchParams.getAll('type')).toEqual(['DEPOSIT', 'TRANSFER_IN']);
    expect(call?.url.searchParams.get('from')).toBe('2026-10-01');
    expect(call?.url.searchParams.get('cursor')).toBe('abc');
  });

  it('WEB-01 la API recibe el Bearer del servidor y la respuesta al navegador no incluye el token', async () => {
    const api = fakeApi().on('GET', '/accounts', () => jsonResponse(200, OVERVIEW));

    const response = await get(['accounts']);

    expect(api.calls[0]?.headers.get('authorization')).toBe('Bearer access-token-1');
    const body = await response.text();
    expect(body).not.toContain('access-token-1');
    expect(body).not.toContain(sessionData().refreshToken);
    expect([...response.headers.values()].join(' ')).not.toContain('access-token-1');
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('WEB-10 reenvía X-Request-Id y la IP del cliente en X-Forwarded-For', async () => {
    const api = fakeApi().on('GET', '/beneficiaries', () => jsonResponse(200, { items: [] }));
    await get(['beneficiaries']);
    expect(api.calls[0]?.headers.get('x-request-id')).toBe('bff-123');
    expect(api.calls[0]?.headers.get('x-forwarded-for')).toBe('203.0.113.7');
  });

  it('WEB-10 reenvía el User-Agent del navegador en las lecturas', async () => {
    const api = fakeApi().on('GET', '/beneficiaries', () => jsonResponse(200, { items: [] }));
    const headers = { ...BROWSER, 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0' };
    resetRequest({ headers, cookies: { sid: SESSION_ID } });
    await get(['beneficiaries'], '', headers);
    expect(api.calls[0]?.headers.get('user-agent')).toBe(
      'Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0',
    );
  });

  it.each([[['accounts', PRINCIPAL.id]], [['transfers', '4f1b0d9c-8a7f-4e6d-9c5b-0d9c8b7a6f5e']]])(
    'WEB-09 permite el detalle %j',
    async (path) => {
      const api = fakeApi().on('GET', /.*/, () => jsonResponse(200, {}));
      expect((await get(path)).status).toBe(200);
      expect(api.calls[0]?.url.pathname).toBe(`/${path.join('/')}`);
    },
  );

  it('WEB-34 WEB-09 permite transfers/scheduled y lo reenvía a listScheduledTransfers con el Bearer', async () => {
    const list = { items: [transfer({ status: 'SCHEDULED', scheduledFor: '2026-10-20' })] };
    const api = fakeApi().on('GET', '/transfers/scheduled', () => jsonResponse(200, list));

    const response = await get(['transfers', 'scheduled']);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(list);
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]?.url.pathname).toBe('/transfers/scheduled');
    expect(api.calls[0]?.headers.get('authorization')).toBe('Bearer access-token-1');
  });

  it.each([
    [['transfers', 'scheduled', 'extra']],
    [['transfers', 'scheduled', '4f1b0d9c-8a7f-4e6d-9c5b-0d9c8b7a6f5e']],
    [['transfers', 'scheduled', '..']],
    [['transfers', 'Scheduled']],
    [['transfers', '4f1b0d9c-8a7f-4e6d-9c5b-0d9c8b7a6f5e', 'cancel']],
  ])('WEB-34 WEB-09 responde 404 sin llamar a la API para %j', async (path) => {
    const api = fakeApi();
    expect((await get(path)).status).toBe(404);
    expect(api.calls).toHaveLength(0);
  });

  it.each([
    [['me']],
    [['users']],
    [['health']],
    [['transfers']],
    [['accounts', 'no-es-uuid']],
    [['accounts', PRINCIPAL.id, 'movements', 'extra']],
    [['accounts', PRINCIPAL.id, 'statements', '2026-09', 'extra']],
    [['accounts', PRINCIPAL.id, 'statements', 'septiembre']],
    [['accounts', PRINCIPAL.id, 'statements']],
    [['accounts', 'no-es-uuid', 'statements', '2026-09']],
    [['..', 'admin']],
    [['auth', 'refresh']],
  ])('WEB-09 responde 404 sin llamar a la API para %j', async (path) => {
    const api = fakeApi();
    const response = await get(path);
    expect(response.status).toBe(404);
    expect(api.calls).toHaveLength(0);
  });

  it('WEB-09 el host de destino es siempre API_BASE_URL, nunca el de la petición', async () => {
    const api = fakeApi().on('GET', '/accounts', () => jsonResponse(200, OVERVIEW));
    await get(['accounts'], '', {
      ...BROWSER,
      host: 'evil.example.com',
      'x-forwarded-host': 'evil.example.com',
    });
    expect(api.calls[0]?.url.host).toBe('localhost:4000');
  });

  it('WEB-03 WEB-22 sin sesión responde 401, borra la cookie y no llama a la API', async () => {
    await sessionStore().delete(SESSION_ID);
    const api = fakeApi();

    const response = await get(['accounts']);

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'UNAUTHENTICATED', requestId: 'bff-123' });
    expect(api.calls).toHaveLength(0);
    expect(cookieValue('sid')).toBeUndefined();
  });

  it('WEB-09 devuelve los problemas de la API con su estado y su code', async () => {
    fakeApi().on('GET', `/accounts/${PRINCIPAL.id}/movements`, () =>
      problemResponse(400, { code: 'INVALID_CURSOR', requestId: 'api-1' }),
    );
    const response = await get(['accounts', PRINCIPAL.id, 'movements'], '?cursor=viejo');
    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(await response.json()).toMatchObject({ code: 'INVALID_CURSOR' });
  });

  it('WEB-08 un fallo de red hacia la API responde 503 con el requestId', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fakeApi().on('GET', '/accounts', () => {
      throw new TypeError('fetch failed');
    });
    const response = await get(['accounts']);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: 'INTERNAL_ERROR', requestId: 'bff-123' });
  });
});

describe('GET /bff/api/accounts/:id/statements/:period', () => {
  // Bytes que no son UTF-8 válido: si el proxy los pasara por texto, se corromperían.
  const PDF = new Uint8Array([
    0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x33, 0x0a, 0xe2, 0xe3, 0xcf, 0xd3, 0x00, 0xff, 0x80,
    0x0a, 0x25, 0x25, 0x45, 0x4f, 0x46,
  ]);
  const FILENAME = 'attachment; filename="estado-de-cuenta-2026-09-0015.pdf"';
  const STATEMENT = `/accounts/${PRINCIPAL.id}/statements/2026-09`;

  it('WEB-32 entrega los bytes del PDF idénticos a los de la API, con su tipo, nombre y longitud', async () => {
    const api = fakeApi().on(
      'GET',
      STATEMENT,
      () =>
        new Response(PDF, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': FILENAME,
            'Content-Length': String(PDF.length),
            'Cache-Control': 'no-store',
            'X-Request-Id': 'api-req',
          },
        }),
    );

    const response = await get(['accounts', PRINCIPAL.id, 'statements', '2026-09']);

    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(PDF);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toBe(FILENAME);
    expect(response.headers.get('content-length')).toBe(String(PDF.length));
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-request-id')).toBe('api-req');
    const [call] = api.calls;
    expect(call?.headers.get('authorization')).toBe('Bearer access-token-1');
    expect(call?.headers.get('accept')).toBe('application/pdf, application/problem+json');
  });

  it('WEB-32 un problema de la API llega con su estado, su cuerpo y Retry-After', async () => {
    fakeApi().on('GET', STATEMENT, () =>
      problemResponse(429, { code: 'RATE_LIMITED', requestId: 'api-1' }, { 'Retry-After': '60' }),
    );
    const response = await get(['accounts', PRINCIPAL.id, 'statements', '2026-09']);
    expect(response.status).toBe(429);
    expect(response.headers.get('content-type')).toContain('application/problem+json');
    expect(response.headers.get('retry-after')).toBe('60');
    expect(response.headers.get('content-disposition')).toBeNull();
    expect(await response.json()).toMatchObject({ code: 'RATE_LIMITED', requestId: 'api-1' });
  });

  it('WEB-32 las demás lecturas siguen pidiendo JSON', async () => {
    const api = fakeApi().on('GET', '/accounts', () => jsonResponse(200, OVERVIEW));
    await get(['accounts']);
    expect(api.calls[0]?.headers.get('accept')).toBe('application/json, application/problem+json');
  });

  it('WEB-09 un POST a la ruta del estado de cuenta responde 405 sin llamar a la API', async () => {
    const api = fakeApi();
    const response = await POST(
      new Request(`http://localhost:3000/bff/api${STATEMENT}`, {
        method: 'POST',
        headers: BROWSER,
      }),
    );
    expect(response.status).toBe(405);
    expect(api.calls).toHaveLength(0);
  });
});

describe('otros métodos en /bff/api/[...path]', () => {
  it.each([
    ['POST', POST],
    ['PUT', PUT],
    ['PATCH', PATCH],
    ['DELETE', DELETE],
  ] as const)('WEB-09 %s responde 405 sin llamar a la API', async (method, handler) => {
    const api = fakeApi();
    const response = await handler(
      new Request('http://localhost:3000/bff/api/transfers', { method, headers: BROWSER }),
    );
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
    expect(api.calls).toHaveLength(0);
  });

  it('WEB-34 WEB-09 un POST a transfers/scheduled responde 405 sin llamar a la API', async () => {
    const api = fakeApi();
    const response = await POST(
      new Request('http://localhost:3000/bff/api/transfers/scheduled', {
        method: 'POST',
        headers: BROWSER,
      }),
    );
    expect(response.status).toBe(405);
    expect(api.calls).toHaveLength(0);
  });
});
