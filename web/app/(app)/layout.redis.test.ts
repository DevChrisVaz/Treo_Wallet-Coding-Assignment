import { createClient } from 'redis';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppFrame } from '@/components/layout/AppFrame';
import { closeRedisClient, SESSION_KEY_PREFIX } from '@/lib/server/redis-session-store';
import { sessionStore } from '@/lib/server/session-store';
import { cookieWrites, resetRequest } from '@/test/support/next-headers';
import { DOWN_REDIS_URL, TEST_REDIS_URL } from '@/test/support/redis';
import { SESSION_ID, sessionData } from '@/test/support/session';
import AppLayout from './layout';

vi.mock('next/headers', () => import('@/test/support/next-headers'));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

const PATH = '/accounts';

function renderLayout() {
  return AppLayout({ children: null, params: Promise.resolve({}) } as never);
}

/** Lo que pierde un proceso nuevo: la conexión a Redis y el Map de sesiones en memoria. */
async function restartServer() {
  await closeRedisClient();
  delete (globalThis as { __treoWalletSessions?: unknown }).__treoWalletSessions;
}

describe.skipIf(!TEST_REDIS_URL)('layout protegido con REDIS_URL', () => {
  const url = TEST_REDIS_URL ?? '';
  const client = createClient({ url });

  beforeAll(async () => {
    await client.connect();
  });

  // Solo su llave: los archivos de prueba corren en paralelo sobre la misma base.
  beforeEach(async () => {
    await client.del(`${SESSION_KEY_PREFIX}${SESSION_ID}`);
    vi.stubEnv('REDIS_URL', url);
  });

  afterAll(async () => {
    await closeRedisClient();
    await client.close();
  });

  it('WEB-37 la sesión sobrevive al reinicio del servidor web', async () => {
    await sessionStore().set(SESSION_ID, sessionData());
    await restartServer();
    resetRequest({ headers: { 'x-wallet-path': PATH }, cookies: { sid: SESSION_ID } });

    const element = await renderLayout();

    expect((element as { type: unknown }).type).toBe(AppFrame);
    expect(await client.exists(`${SESSION_KEY_PREFIX}${SESSION_ID}`)).toBe(1);
  });

  it('WEB-37 con REDIS_URL las sesiones no se guardan en la memoria del proceso', async () => {
    await restartServer();
    await sessionStore().set(SESSION_ID, sessionData());
    const memory = (globalThis as { __treoWalletSessions?: Map<string, unknown> })
      .__treoWalletSessions;
    expect(memory?.has(SESSION_ID) ?? false).toBe(false);
  });
});

describe('layout protegido con Redis caído', () => {
  afterAll(async () => {
    await closeRedisClient();
  });

  it('WEB-37 falla con error del servidor en vez de quedarse esperando y conserva la cookie', async () => {
    vi.stubEnv('REDIS_URL', DOWN_REDIS_URL);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    resetRequest({ headers: { 'x-wallet-path': PATH }, cookies: { sid: SESSION_ID } });

    await expect(renderLayout()).rejects.toThrow(/ECONNREFUSED/);
    expect(cookieWrites()).toEqual([]);
  });
});
