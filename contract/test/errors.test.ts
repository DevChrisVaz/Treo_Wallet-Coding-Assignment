import { describe, expect, it } from 'vitest';
import { createApiClient, NetworkError, ProblemError } from '../src/index';
import { fakeFetch } from './support/fake-fetch';

function problemResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

async function rejectionOf(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Se esperaba que la petición fallara');
}

const transferId = '3c2b1a09-8f7e-4d6c-9b5a-4f3e2d1c0b9a';

describe('errores de la API', () => {
  it('CTR-07 un 422 problem+json llega como ProblemError con code y extensiones', async () => {
    const { fetch } = fakeFetch(() =>
      problemResponse(422, {
        type: '/problems/insufficient-funds',
        title: 'Saldo insuficiente',
        status: 422,
        detail: 'La cuenta no tiene saldo suficiente para esta transferencia.',
        instance: '/transfers',
        code: 'INSUFFICIENT_FUNDS',
        requestId: 'req-1',
        transferId,
      }),
    );
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    const error = await rejectionOf(client.GET('/accounts'));

    expect(error).toBeInstanceOf(ProblemError);
    expect(error).toMatchObject({
      status: 422,
      code: 'INSUFFICIENT_FUNDS',
      title: 'Saldo insuficiente',
      requestId: 'req-1',
      transferId,
    });
  });

  it('CTR-07 conserva los errores por campo de VALIDATION_FAILED', async () => {
    const errors = [
      { pointer: '/amount', code: 'TOO_MANY_DECIMALS', message: 'Máximo 2 decimales' },
    ];
    const { fetch } = fakeFetch(() =>
      problemResponse(422, {
        type: '/problems/validation-failed',
        title: 'Datos inválidos',
        status: 422,
        code: 'VALIDATION_FAILED',
        requestId: 'req-2',
        errors,
      }),
    );
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    const error = await rejectionOf(client.GET('/accounts'));

    expect(error).toMatchObject({ code: 'VALIDATION_FAILED', errors });
  });

  it('CTR-07 un code que el paquete no conoce se reporta como INTERNAL_ERROR sin perder el original', async () => {
    const { fetch } = fakeFetch(() =>
      problemResponse(409, {
        type: '/problems/new',
        title: 'Nuevo',
        status: 409,
        code: 'SOMETHING_NEW',
        requestId: 'req-3',
      }),
    );
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    const error = await rejectionOf(client.GET('/accounts'));

    expect(error).toMatchObject({ status: 409, code: 'INTERNAL_ERROR', rawCode: 'SOMETHING_NEW' });
  });

  it('CTR-07 un 502 con HTML llega como INTERNAL_ERROR con el status original y sin el cuerpo', async () => {
    const html = '<html><body>Bad Gateway from upstream proxy-7</body></html>';
    const { fetch } = fakeFetch(
      () =>
        new Response(html, {
          status: 502,
          headers: { 'Content-Type': 'text/html', 'X-Request-Id': 'req-4' },
        }),
    );
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    const error = await rejectionOf(client.GET('/accounts'));

    expect(error).toBeInstanceOf(ProblemError);
    expect(error).toMatchObject({ status: 502, code: 'INTERNAL_ERROR', requestId: 'req-4' });
    const exposed = JSON.stringify({ ...(error as object), message: (error as Error).message });
    expect(exposed).not.toContain('proxy-7');
  });
});

describe('Retry-After', () => {
  const login = { email: 'ana@example.com', password: 'una-contraseña-larga' };

  function rateLimited(retryAfter?: string): Response {
    const headers = new Headers({ 'Content-Type': 'application/problem+json' });
    if (retryAfter !== undefined) headers.set('Retry-After', retryAfter);
    return new Response(
      JSON.stringify({
        type: '/problems/rate-limited',
        title: 'Demasiados intentos',
        status: 429,
        code: 'RATE_LIMITED',
        requestId: 'req-5',
      }),
      { status: 429, headers },
    );
  }

  it('CTR-07 un 429 con Retry-After expone retryAfter en segundos', async () => {
    const { fetch } = fakeFetch(() => rateLimited('300'));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    const error = await rejectionOf(client.POST('/auth/login', { body: login }));

    expect(error).toBeInstanceOf(ProblemError);
    expect(error).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfter: 300 });
  });

  it.each([
    ['sin header', undefined],
    ['0', '0'],
    ['-5', '-5'],
    ['1.5', '1.5'],
    ['abc', 'abc'],
    ['como fecha HTTP', 'Wed, 21 Oct 2026 07:28:00 GMT'],
  ])('CTR-07 Retry-After %s deja retryAfter sin definir', async (_, retryAfter) => {
    const { fetch } = fakeFetch(() => rateLimited(retryAfter));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    const error = await rejectionOf(client.POST('/auth/login', { body: login }));

    expect(error).toMatchObject({ code: 'RATE_LIMITED' });
    expect((error as ProblemError).retryAfter).toBeUndefined();
  });

  it('CTR-07 un 503 que no es problem+json también conserva Retry-After', async () => {
    const { fetch } = fakeFetch(
      () =>
        new Response('<html>Mantenimiento</html>', {
          status: 503,
          headers: { 'Content-Type': 'text/html', 'Retry-After': '120' },
        }),
    );
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    const error = await rejectionOf(client.GET('/accounts'));

    expect(error).toMatchObject({ status: 503, code: 'INTERNAL_ERROR', retryAfter: 120 });
  });
});

describe('errores de red', () => {
  it('CTR-07 una petición sin respuesta llega como NetworkError, distinto de ProblemError', async () => {
    const { fetch } = fakeFetch(() => {
      throw new TypeError('fetch failed');
    });
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    const error = await rejectionOf(client.GET('/accounts'));

    expect(error).toBeInstanceOf(NetworkError);
    expect(error).not.toBeInstanceOf(ProblemError);
  });
});
