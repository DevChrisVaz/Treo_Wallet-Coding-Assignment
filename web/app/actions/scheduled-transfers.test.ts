import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionStore } from '@/lib/server/session-store';
import { transfer } from '@/test/fixtures';
import { fakeApi, jsonResponse, problemResponse } from '@/test/support/fake-api';
import { cookieValue, resetRequest } from '@/test/support/next-headers';
import { SESSION_ID, sessionData } from '@/test/support/session';
import { cancelTransfer } from './scheduled-transfers';

vi.mock('next/headers', () => import('@/test/support/next-headers'));

const BROWSER = { 'x-request-id': 'bff-123', 'x-forwarded-for': '203.0.113.7' };
const TRANSFER_ID = transfer().id;
const CANCEL_PATH = `/transfers/${TRANSFER_ID}/cancel`;
const cancelled = () =>
  transfer({
    status: 'CANCELLED',
    scheduledFor: '2026-10-20',
    completedAt: null,
    cancelledAt: '2026-10-14T18:00:00.000Z',
  });

beforeEach(async () => {
  await sessionStore().delete(SESSION_ID);
  await sessionStore().set(SESSION_ID, sessionData());
  resetRequest({ headers: BROWSER, cookies: { sid: SESSION_ID } });
});

describe('cancelTransfer', () => {
  it('WEB-34 llama a cancelTransfer una sola vez con el Bearer de la sesión y devuelve la cancelada', async () => {
    const api = fakeApi().on('POST', CANCEL_PATH, () => jsonResponse(200, cancelled()));

    const result = await cancelTransfer({ transferId: TRANSFER_ID });

    expect(result).toEqual({ ok: true, data: cancelled() });
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]?.method).toBe('POST');
    expect(api.calls[0]?.url.pathname).toBe(CANCEL_PATH);
    expect(api.calls[0]?.headers.get('authorization')).toBe('Bearer access-token-1');
  });

  it('WEB-10 reenvía X-Request-Id y la IP del cliente', async () => {
    const api = fakeApi().on('POST', CANCEL_PATH, () => jsonResponse(200, cancelled()));
    await cancelTransfer({ transferId: TRANSFER_ID });
    expect(api.calls[0]?.headers.get('x-request-id')).toBe('bff-123');
    expect(api.calls[0]?.headers.get('x-forwarded-for')).toBe('203.0.113.7');
  });

  it('WEB-34 WEB-08 devuelve 409 TRANSFER_NOT_CANCELLABLE con transferStatus como valor', async () => {
    fakeApi().on('POST', CANCEL_PATH, () =>
      problemResponse(409, {
        code: 'TRANSFER_NOT_CANCELLABLE',
        transferStatus: 'COMPLETED',
        requestId: 'api-1',
      }),
    );

    expect(await cancelTransfer({ transferId: TRANSFER_ID })).toEqual({
      ok: false,
      problem: expect.objectContaining({
        status: 409,
        code: 'TRANSFER_NOT_CANCELLABLE',
        transferStatus: 'COMPLETED',
        requestId: 'api-1',
      }),
    });
  });

  it('WEB-08 devuelve NOT_FOUND de una transferencia ajena', async () => {
    fakeApi().on('POST', CANCEL_PATH, () =>
      problemResponse(404, { code: 'NOT_FOUND', requestId: 'api-1' }),
    );
    expect(await cancelTransfer({ transferId: TRANSFER_ID })).toMatchObject({
      ok: false,
      problem: { status: 404, code: 'NOT_FOUND' },
    });
  });

  it.each([[{ transferId: '../accounts' }], [{ transferId: 'no-es-uuid' }], [{}], ['texto']])(
    'WEB-07 con la entrada %j responde VALIDATION_FAILED sin llamar a la API',
    async (input) => {
      const api = fakeApi();
      expect(await cancelTransfer(input)).toMatchObject({
        ok: false,
        problem: { code: 'VALIDATION_FAILED', status: 422 },
      });
      expect(api.calls).toHaveLength(0);
    },
  );

  it('WEB-07 rechaza campos de más sin llamar a la API', async () => {
    const api = fakeApi();
    expect(await cancelTransfer({ transferId: TRANSFER_ID, status: 'COMPLETED' })).toMatchObject({
      ok: false,
      problem: { code: 'VALIDATION_FAILED' },
    });
    expect(api.calls).toHaveLength(0);
  });

  it('WEB-07 sin sesión responde UNAUTHENTICATED sin llamar a la API', async () => {
    resetRequest({ headers: BROWSER });
    const api = fakeApi();
    expect(await cancelTransfer({ transferId: TRANSFER_ID })).toMatchObject({
      ok: false,
      problem: { code: 'UNAUTHENTICATED', status: 401 },
    });
    expect(api.calls).toHaveLength(0);
  });

  it('WEB-03 si la API rechaza el token, termina la sesión local', async () => {
    fakeApi().on('POST', CANCEL_PATH, () =>
      problemResponse(401, { code: 'UNAUTHENTICATED', requestId: 'api-1' }),
    );
    expect(await cancelTransfer({ transferId: TRANSFER_ID })).toMatchObject({
      ok: false,
      problem: { code: 'UNAUTHENTICATED' },
    });
    expect(await sessionStore().get(SESSION_ID)).toBeNull();
    expect(cookieValue('sid')).toBeUndefined();
  });

  it('WEB-08 un fallo de red llega como INTERNAL_ERROR con el requestId y sin el mensaje interno', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fakeApi().on('POST', CANCEL_PATH, () => {
      throw new TypeError('fetch failed: connect ECONNREFUSED 127.0.0.1:4000');
    });

    const result = await cancelTransfer({ transferId: TRANSFER_ID });

    expect(result).toMatchObject({
      ok: false,
      problem: { code: 'INTERNAL_ERROR', requestId: 'bff-123' },
    });
    expect(JSON.stringify(result)).not.toContain('ECONNREFUSED');
  });

  it('WEB-01 el resultado no contiene los tokens de la sesión', async () => {
    fakeApi().on('POST', CANCEL_PATH, () => jsonResponse(200, cancelled()));
    const serialized = JSON.stringify(await cancelTransfer({ transferId: TRANSFER_ID }));
    expect(serialized).not.toContain('access-token-1');
    expect(serialized).not.toContain(sessionData().refreshToken);
  });
});
