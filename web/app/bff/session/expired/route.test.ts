import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionStore } from '@/lib/server/session-store';
import { cookieValue, resetRequest } from '@/test/support/next-headers';
import { SESSION_ID, sessionData } from '@/test/support/session';
import { GET } from './route';

vi.mock('next/headers', () => import('@/test/support/next-headers'));

function get(query: string) {
  return GET(new Request(`http://localhost:3000/bff/session/expired${query}`));
}

beforeEach(async () => {
  await sessionStore().delete(SESSION_ID);
  resetRequest({ cookies: { sid: SESSION_ID } });
});

describe('GET /bff/session/expired', () => {
  it('WEB-03 borra la cookie de una sesión que ya no existe y muestra "Tu sesión expiró"', async () => {
    const response = await get('?next=%2Fbeneficiaries');
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/login?next=%2Fbeneficiaries&reason=expired');
    expect(cookieValue('sid')).toBeUndefined();
  });

  it('WEB-22 nunca redirige fuera de la web', async () => {
    const response = await get('?next=https%3A%2F%2Fevil.example.com');
    expect(response.headers.get('location')).toBe('/login?reason=expired');
  });

  it('WEB-03 no toca una sesión que sigue activa: vuelve a la ruta pedida', async () => {
    await sessionStore().set(SESSION_ID, sessionData());
    const response = await get('?next=%2Fbeneficiaries');
    expect(response.headers.get('location')).toBe('/beneficiaries');
    expect(cookieValue('sid')).toBe(SESSION_ID);
  });
});
