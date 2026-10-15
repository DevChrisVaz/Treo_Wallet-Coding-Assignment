import { NetworkError, ProblemError } from '@devchrisvaz/wallet-contract';
import { beforeEach, describe, expect, it } from 'vitest';
import { OVERVIEW } from '@/test/fixtures';
import { deferred, fakeApi, jsonResponse, problemResponse } from '@/test/support/fake-api';
import { SESSION_ID, sessionData, tokenPair } from '@/test/support/session';
import { publicApi, SessionEndedError, sessionApi } from './api-client';
import { sessionStore } from './session-store';

const CONTEXT = { requestId: 'bff-123', clientIp: '203.0.113.7' };

beforeEach(async () => {
  await sessionStore().delete(SESSION_ID);
});

describe('sessionApi', () => {
  it('WEB-01 adjunta el Bearer de la sesión del servidor, el request id y la IP del cliente', async () => {
    await sessionStore().set(SESSION_ID, sessionData());
    const api = fakeApi().on('GET', '/accounts', () => jsonResponse(200, OVERVIEW));

    const { data } = await sessionApi(SESSION_ID, CONTEXT).GET('/accounts');

    expect(data).toEqual(OVERVIEW);
    const [call] = api.calls;
    expect(call?.url.origin).toBe('http://localhost:4000');
    expect(call?.headers.get('authorization')).toBe('Bearer access-token-1');
    expect(call?.headers.get('x-request-id')).toBe('bff-123');
    expect(call?.headers.get('x-forwarded-for')).toBe('203.0.113.7');
  });

  it('WEB-04 tres peticiones simultáneas con el token vencido hacen una sola renovación', async () => {
    const now = new Date();
    await sessionStore().set(
      SESSION_ID,
      sessionData({ accessTokenExpiresAt: new Date(now.getTime() - 1000).toISOString() }, now),
    );
    const refresh = deferred<Response>();
    const api = fakeApi()
      .on('POST', '/auth/refresh', () => refresh.promise)
      .on('GET', '/accounts', () => jsonResponse(200, OVERVIEW));

    const requests = [1, 2, 3].map(() => sessionApi(SESSION_ID, CONTEXT).GET('/accounts'));
    await new Promise((resolve) => setTimeout(resolve, 10));
    refresh.resolve(jsonResponse(200, tokenPair('2', now)));
    await Promise.all(requests);

    expect(api.callsTo('POST', '/auth/refresh')).toHaveLength(1);
    expect(api.callsTo('POST', '/auth/refresh')[0]?.body).toEqual({
      refreshToken: sessionData().refreshToken,
    });
    const reads = api.callsTo('GET', '/accounts');
    expect(reads).toHaveLength(3);
    for (const read of reads) {
      expect(read.headers.get('authorization')).toBe('Bearer access-token-2');
    }
    const stored = await sessionStore().get(SESSION_ID);
    expect(stored?.refreshToken).toBe(tokenPair('2').refreshToken);
  });

  it('WEB-04 renueva si el access token vence en menos de 30 segundos y no antes', async () => {
    const now = new Date();
    await sessionStore().set(
      SESSION_ID,
      sessionData({ accessTokenExpiresAt: new Date(now.getTime() + 20_000).toISOString() }, now),
    );
    const api = fakeApi()
      .on('POST', '/auth/refresh', () => jsonResponse(200, tokenPair('2', now)))
      .on('GET', '/accounts', () => jsonResponse(200, OVERVIEW));

    await sessionApi(SESSION_ID, CONTEXT).GET('/accounts');
    await sessionApi(SESSION_ID, CONTEXT).GET('/accounts');

    expect(api.callsTo('POST', '/auth/refresh')).toHaveLength(1);
  });

  it('WEB-04 si la renovación responde SESSION_REVOKED, elimina la sesión y no llama al recurso', async () => {
    await sessionStore().set(
      SESSION_ID,
      sessionData({ accessTokenExpiresAt: new Date(Date.now() - 1000).toISOString() }),
    );
    const api = fakeApi()
      .on('POST', '/auth/refresh', () =>
        problemResponse(401, { code: 'SESSION_REVOKED', requestId: 'r1' }),
      )
      .on('GET', '/accounts', () => jsonResponse(200, OVERVIEW));

    const results = await Promise.allSettled(
      [1, 2].map(() => sessionApi(SESSION_ID, CONTEXT).GET('/accounts')),
    );

    for (const result of results) {
      expect(result.status).toBe('rejected');
      const reason = (result as PromiseRejectedResult).reason as SessionEndedError;
      expect(reason).toBeInstanceOf(SessionEndedError);
      expect(reason.code).toBe('SESSION_REVOKED');
    }
    expect(api.callsTo('POST', '/auth/refresh')).toHaveLength(1);
    expect(api.callsTo('GET', '/accounts')).toHaveLength(0);
    expect(await sessionStore().get(SESSION_ID)).toBeNull();
  });

  it('WEB-04 un fallo de red al renovar no cierra la sesión', async () => {
    await sessionStore().set(
      SESSION_ID,
      sessionData({ accessTokenExpiresAt: new Date(Date.now() - 1000).toISOString() }),
    );
    fakeApi().on('POST', '/auth/refresh', () => {
      throw new TypeError('fetch failed');
    });

    await expect(sessionApi(SESSION_ID, CONTEXT).GET('/accounts')).rejects.toBeInstanceOf(
      NetworkError,
    );
    expect(await sessionStore().get(SESSION_ID)).not.toBeNull();
  });

  it('WEB-07 sin sesión activa falla con UNAUTHENTICATED sin llamar a la API', async () => {
    const api = fakeApi();
    const error = await sessionApi(SESSION_ID, CONTEXT)
      .GET('/accounts')
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SessionEndedError);
    expect((error as SessionEndedError).code).toBe('UNAUTHENTICATED');
    expect(api.calls).toHaveLength(0);
  });
});

describe('User-Agent hacia la API', () => {
  const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.6 Safari/605.1.15';
  const WITH_UA = { ...CONTEXT, userAgent: BROWSER_UA };

  it('WEB-10 una llamada pública (login) lleva el User-Agent del navegador', async () => {
    const api = fakeApi().on('POST', '/auth/verify-email/resend', () =>
      jsonResponse(202, { message: 'ok' }),
    );
    await publicApi(WITH_UA).POST('/auth/verify-email/resend', {
      body: { email: 'ana@example.com' },
    });
    expect(api.calls[0]?.headers.get('user-agent')).toBe(BROWSER_UA);
  });

  it('WEB-10 las lecturas de la sesión y la renovación del access token también lo llevan', async () => {
    const now = new Date();
    await sessionStore().set(
      SESSION_ID,
      sessionData({ accessTokenExpiresAt: new Date(now.getTime() - 1000).toISOString() }, now),
    );
    const api = fakeApi()
      .on('POST', '/auth/refresh', () => jsonResponse(200, tokenPair('2', now)))
      .on('GET', '/accounts', () => jsonResponse(200, OVERVIEW));

    await sessionApi(SESSION_ID, WITH_UA).GET('/accounts');

    expect(api.callsTo('POST', '/auth/refresh')[0]?.headers.get('user-agent')).toBe(BROWSER_UA);
    expect(api.callsTo('GET', '/accounts')[0]?.headers.get('user-agent')).toBe(BROWSER_UA);
  });

  it('WEB-10 sin User-Agent en la petición, la web no pone uno suyo', async () => {
    const api = fakeApi().on('POST', '/auth/verify-email/resend', () =>
      jsonResponse(202, { message: 'ok' }),
    );
    await publicApi(CONTEXT).POST('/auth/verify-email/resend', {
      body: { email: 'ana@example.com' },
    });
    expect(api.calls[0]?.headers.has('user-agent')).toBe(false);
  });
});

describe('publicApi', () => {
  it('WEB-10 envía la IP del cliente y el request id, sin Authorization', async () => {
    const api = fakeApi().on('POST', '/auth/verify-email/resend', () =>
      jsonResponse(202, { message: 'ok' }),
    );
    await publicApi(CONTEXT).POST('/auth/verify-email/resend', {
      body: { email: 'ana@example.com' },
    });
    const [call] = api.calls;
    expect(call?.headers.get('x-forwarded-for')).toBe('203.0.113.7');
    expect(call?.headers.get('x-request-id')).toBe('bff-123');
    expect(call?.headers.has('authorization')).toBe(false);
  });

  it('WEB-12 conserva Retry-After de un 429 en el ProblemError', async () => {
    fakeApi().on('POST', '/auth/login', () =>
      problemResponse(429, { code: 'RATE_LIMITED', requestId: 'r1' }, { 'Retry-After': '300' }),
    );
    const error = await publicApi(CONTEXT)
      .POST('/auth/login', { body: { email: 'ana@example.com', password: 'x' } })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ProblemError);
    expect((error as ProblemError).code).toBe('RATE_LIMITED');
    expect((error as ProblemError).retryAfter).toBe(300);
  });
});
