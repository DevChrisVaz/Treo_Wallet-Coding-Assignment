import { transferForm } from '@devchrisvaz/wallet-contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AHORRO, OVERVIEW, PRINCIPAL } from '@/test/fixtures';
import { fakeApi, jsonResponse, problemResponse } from '@/test/support/fake-api';
import { cookieValue, cookieWrites, resetRequest } from '@/test/support/next-headers';
import { SESSION_ID, sessionData } from '@/test/support/session';
import { publicAction, sessionAction } from './action';
import { requireSession } from './session';
import { SessionEndedError } from './api-client';
import { sessionStore } from './session-store';

vi.mock('next/headers', () => import('@/test/support/next-headers'));

const VALID_TRANSFER = {
  fromAccountId: PRINCIPAL.id,
  destination: { type: 'OWN_ACCOUNT', accountId: AHORRO.id },
  amount: '100.00',
  concept: 'Ahorro',
  reference: '1',
};

const BROWSER = { 'x-request-id': 'bff-123', 'x-forwarded-for': '203.0.113.7' };

beforeEach(async () => {
  await sessionStore().delete(SESSION_ID);
  resetRequest({ headers: BROWSER, cookies: { sid: SESSION_ID } });
});

describe('sessionAction', () => {
  it('WEB-07 una entrada inválida devuelve VALIDATION_FAILED con el campo, sin llamar a la API', async () => {
    await sessionStore().set(SESSION_ID, sessionData());
    const api = fakeApi();
    const work = vi.fn();

    const result = await sessionAction(
      transferForm,
      { ...VALID_TRANSFER, amount: '100.005' },
      work,
    );

    expect(result).toMatchObject({
      ok: false,
      problem: { code: 'VALIDATION_FAILED', status: 422, requestId: 'bff-123' },
    });
    expect(!result.ok && result.problem.errors?.map((error) => error.pointer)).toEqual(['/amount']);
    expect(work).not.toHaveBeenCalled();
    expect(api.calls).toHaveLength(0);
  });

  it('WEB-07 sin cookie de sesión válida devuelve UNAUTHENTICATED sin llamar a la API', async () => {
    resetRequest({ headers: BROWSER });
    const api = fakeApi();
    const work = vi.fn();

    const result = await sessionAction(transferForm, VALID_TRANSFER, work);

    expect(result).toMatchObject({ ok: false, problem: { code: 'UNAUTHENTICATED', status: 401 } });
    expect(work).not.toHaveBeenCalled();
    expect(api.calls).toHaveLength(0);
  });

  it('WEB-03 con una cookie de una sesión que ya expiró, responde UNAUTHENTICATED y borra la cookie', async () => {
    const result = await sessionAction(null, undefined, vi.fn());
    expect(result).toMatchObject({ ok: false, problem: { code: 'UNAUTHENTICATED' } });
    expect(cookieValue('sid')).toBeUndefined();
    expect(cookieWrites()).toEqual([expect.objectContaining({ name: 'sid', value: '' })]);
  });

  it('WEB-01 con sesión, ejecuta la operación con la API autenticada y devuelve sus datos', async () => {
    await sessionStore().set(SESSION_ID, sessionData());
    fakeApi().on('GET', '/accounts', () => jsonResponse(200, OVERVIEW));

    const result = await sessionAction(null, undefined, async ({ api }) => {
      const { data } = await api.GET('/accounts');
      return data;
    });

    expect(result).toEqual({ ok: true, data: OVERVIEW });
  });

  it('WEB-03 cada operación autenticada renueva el plazo de inactividad', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-13T16:00:00.000Z'));
      await sessionStore().set(SESSION_ID, sessionData());
      vi.setSystemTime(new Date('2026-10-13T16:14:00.000Z'));
      await sessionAction(null, undefined, async () => 'ok');
      expect((await sessionStore().get(SESSION_ID))?.lastSeenAt).toBe('2026-10-13T16:14:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

  it('WEB-08 un rechazo de negocio llega con su code, title, detail y transferId', async () => {
    await sessionStore().set(SESSION_ID, sessionData());
    fakeApi().on('POST', '/transfers', () =>
      problemResponse(422, {
        code: 'INSUFFICIENT_FUNDS',
        title: 'Saldo insuficiente',
        detail: 'La cuenta no tiene saldo suficiente.',
        transferId: '4f1b0d9c-8a7f-4e6d-9c5b-0d9c8b7a6f5e',
        requestId: 'api-1',
      }),
    );

    const result = await sessionAction(transferForm, VALID_TRANSFER, async ({ api, data }) => {
      await api.POST('/transfers', {
        params: { header: { 'Idempotency-Key': '9b2f0c1e-5a4d-4e3b-8c2a-1f0e9d8c7b6a' } },
        body: data,
      });
    });

    expect(result).toEqual({
      ok: false,
      problem: {
        type: 'about:blank',
        status: 422,
        code: 'INSUFFICIENT_FUNDS',
        title: 'Saldo insuficiente',
        detail: 'La cuenta no tiene saldo suficiente.',
        transferId: '4f1b0d9c-8a7f-4e6d-9c5b-0d9c8b7a6f5e',
        requestId: 'api-1',
      },
    });
  });

  it('WEB-08 una excepción no prevista llega como INTERNAL_ERROR con el requestId, sin mensaje ni traza', async () => {
    await sessionStore().set(SESSION_ID, sessionData());
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const result = await sessionAction(null, undefined, async () => {
      throw new Error('detalle interno: token=secreto');
    });

    expect(result).toEqual({
      ok: false,
      problem: {
        type: '/problems/internal-error',
        title: 'Error interno',
        status: 500,
        code: 'INTERNAL_ERROR',
        requestId: 'bff-123',
      },
    });
    expect(JSON.stringify(result)).not.toContain('secreto');
    expect(JSON.stringify(result)).not.toContain('detalle interno');
    expect(String(log.mock.calls[0]?.[0])).toContain('bff-123');
  });

  it('WEB-17 un fallo de red hacia la API llega como INTERNAL_ERROR 503, que el cliente puede reintentar', async () => {
    await sessionStore().set(SESSION_ID, sessionData());
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fakeApi().on('GET', '/accounts', () => {
      throw new TypeError('fetch failed');
    });

    const result = await sessionAction(null, undefined, ({ api }) => api.GET('/accounts'));

    expect(result).toMatchObject({
      ok: false,
      problem: { code: 'INTERNAL_ERROR', status: 503, requestId: 'bff-123' },
    });
  });

  it('WEB-04 si la sesión terminó en la API, borra la cookie y devuelve el code', async () => {
    await sessionStore().set(SESSION_ID, sessionData());

    const result = await sessionAction(null, undefined, async () => {
      throw new SessionEndedError('SESSION_REVOKED');
    });

    expect(result).toMatchObject({ ok: false, problem: { code: 'SESSION_REVOKED', status: 401 } });
    expect(cookieValue('sid')).toBeUndefined();
  });

  it('WEB-04 un 401 de la API cierra la sesión local', async () => {
    await sessionStore().set(SESSION_ID, sessionData());
    fakeApi().on('GET', '/accounts', () =>
      problemResponse(401, { code: 'UNAUTHENTICATED', requestId: 'api-1' }),
    );

    const result = await sessionAction(null, undefined, ({ api }) => api.GET('/accounts'));

    expect(result).toMatchObject({ ok: false, problem: { code: 'UNAUTHENTICATED' } });
    expect(await sessionStore().get(SESSION_ID)).toBeNull();
    expect(cookieValue('sid')).toBeUndefined();
  });
});

describe('publicAction', () => {
  it('WEB-12 conserva retryAfter de un 429', async () => {
    fakeApi().on('POST', '/auth/login', () =>
      problemResponse(429, { code: 'RATE_LIMITED', requestId: 'api-1' }, { 'Retry-After': '300' }),
    );

    const result = await publicAction(null, undefined, ({ api }) =>
      api.POST('/auth/login', { body: { email: 'ana@example.com', password: 'x' } }),
    );

    expect(result).toMatchObject({
      ok: false,
      problem: { code: 'RATE_LIMITED', status: 429, retryAfter: 300 },
    });
  });

  it('WEB-07 valida la entrada con el esquema del contrato antes de llamar a la API', async () => {
    const api = fakeApi();
    const result = await publicAction(transferForm, {}, vi.fn());
    expect(result).toMatchObject({ ok: false, problem: { code: 'VALIDATION_FAILED' } });
    expect(api.calls).toHaveLength(0);
  });
});

describe('requireSession', () => {
  it('WEB-22 devuelve la sesión activa y falla con UNAUTHENTICATED si no hay', async () => {
    await expect(requireSession()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await sessionStore().set(SESSION_ID, sessionData());
    await expect(requireSession()).resolves.toMatchObject({ sessionId: SESSION_ID });
  });
});
