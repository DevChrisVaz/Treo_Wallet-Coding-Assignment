import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionStore } from '@/lib/server/session-store';
import { USER } from '@/test/fixtures';
import { fakeApi } from '@/test/support/fake-api';
import { resetRequest } from '@/test/support/next-headers';
import { SESSION_ID, sessionData } from '@/test/support/session';
import { GET } from './route';

vi.mock('next/headers', () => import('@/test/support/next-headers'));

const BROWSER = { 'x-request-id': 'bff-123' };
const request = () => new Request('http://localhost:3000/bff/api/session', { headers: BROWSER });

beforeEach(async () => {
  await sessionStore().delete(SESSION_ID);
  resetRequest({ headers: BROWSER, cookies: { sid: SESSION_ID } });
});

describe('GET /bff/api/session', () => {
  it('WEB-01 responde con el usuario guardado en la sesión, sin tokens y sin llamar a la API', async () => {
    await sessionStore().set(SESSION_ID, sessionData());
    const api = fakeApi();

    const response = await GET(request());

    expect(response.status).toBe(200);
    const body = await response.text();
    expect(JSON.parse(body)).toEqual({ user: USER });
    expect(body).not.toContain('access-token-1');
    expect(body).not.toContain('refresh-token-1');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(api.calls).toHaveLength(0);
  });

  it('WEB-22 sin sesión responde 401 UNAUTHENTICATED', async () => {
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'UNAUTHENTICATED', requestId: 'bff-123' });
  });
});
