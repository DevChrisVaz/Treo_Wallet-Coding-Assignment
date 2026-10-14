import { createClient } from 'redis';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionData, tokenPair } from '@/test/support/session';
import { describeSessionStoreContract } from '@/test/support/session-store-contract';
import {
  closeRedisClient,
  createRedisSessionStore,
  redisClient,
  SESSION_KEY_PREFIX,
  type RedisClient,
} from './redis-session-store';

const MINUTE = 60_000;
const TEST_REDIS_URL = testRedisUrl();
/** Un puerto donde nada escucha: la conexión se rechaza de inmediato. */
const DOWN_REDIS_URL = 'redis://127.0.0.1:1';

/** `TEST_REDIS_URL` apunta a una base que las pruebas vacían; en CI es obligatoria (D6). */
function testRedisUrl(): string | undefined {
  const url = process.env.TEST_REDIS_URL?.trim();
  if (!url) {
    if (process.env.CI) {
      throw new Error('TEST_REDIS_URL es obligatoria en CI: las pruebas de Redis no se saltan ahí');
    }
    return undefined;
  }
  if (['', '/', '/0'].includes(new URL(url).pathname)) {
    throw new Error(
      'TEST_REDIS_URL debe apuntar a una base distinta de la 0, porque las pruebas la vacían; ' +
        'por ejemplo redis://localhost:6379/15',
    );
  }
  return url;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

describe('redisClient', () => {
  it('WEB-37 con Redis caído la conexión falla en segundos en vez de quedarse esperando', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const started = Date.now();
    await expect(redisClient(DOWN_REDIS_URL)).rejects.toThrow(/ECONNREFUSED/);
    expect(Date.now() - started).toBeLessThan(3_000);
    const line = JSON.parse(String(log.mock.calls[0]?.[0])) as Record<string, unknown>;
    expect(line).toMatchObject({ level: 'error', msg: 'Error de conexión con Redis' });
  });

  it('WEB-37 tras un fallo al conectar, el siguiente uso vuelve a intentar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const first = redisClient(DOWN_REDIS_URL);
    await first.catch(() => undefined);
    const second = redisClient(DOWN_REDIS_URL);
    expect(second).not.toBe(first);
    await second.catch(() => undefined);
  });
});

describe.skipIf(!TEST_REDIS_URL)('createRedisSessionStore', () => {
  const url = TEST_REDIS_URL ?? '';
  let client: RedisClient;

  function store(idleMs = 15 * MINUTE) {
    return createRedisSessionStore({ connection: () => Promise.resolve(client), idleMs });
  }

  beforeAll(async () => {
    client = createClient({ url });
    await client.connect();
  });

  beforeEach(async () => {
    await client.flushDb();
  });

  afterAll(async () => {
    await client.close();
    await closeRedisClient();
  });

  describeSessionStoreContract('Redis', () => ({
    idleMs: 1_000,
    create: () => store(1_000),
    advance: wait,
  }));

  it('WEB-37 guarda cada sesión en un hash con el prefijo y el plazo de inactividad como TTL', async () => {
    await store().set('sid-1', sessionData());
    const key = `${SESSION_KEY_PREFIX}sid-1`;
    expect(await client.type(key)).toBe('hash');
    const ttl = await client.pTTL(key);
    expect(ttl).toBeGreaterThan(15 * MINUTE - 2_000);
    expect(ttl).toBeLessThanOrEqual(15 * MINUTE);
  });

  it('WEB-37 el TTL no pasa de la vigencia absoluta del refresh', async () => {
    const now = new Date();
    const deadline = new Date(now.getTime() + 2 * MINUTE).toISOString();
    await store().set('sid-1', sessionData({ refreshTokenExpiresAt: deadline }, now));
    const ttl = await client.pTTL(`${SESSION_KEY_PREFIX}sid-1`);
    expect(ttl).toBeGreaterThan(2 * MINUTE - 2_000);
    expect(ttl).toBeLessThanOrEqual(2 * MINUTE);
  });

  it('WEB-37 el plazo cuenta desde la última petición y touch lo reinicia', async () => {
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * MINUTE).toISOString();
    await store().set('sid-1', sessionData({ lastSeenAt: tenMinutesAgo }, now));
    const key = `${SESSION_KEY_PREFIX}sid-1`;
    expect(await client.pTTL(key)).toBeLessThanOrEqual(5 * MINUTE);
    await store().touch('sid-1', now);
    expect(await client.pTTL(key)).toBeGreaterThan(15 * MINUTE - 2_000);
  });

  it('WEB-37 una sesión que ya venció no se guarda', async () => {
    const now = new Date();
    const past = new Date(now.getTime() - 1).toISOString();
    await store().set('sid-1', sessionData({ refreshTokenExpiresAt: past }, now));
    expect(await client.exists(`${SESSION_KEY_PREFIX}sid-1`)).toBe(0);
  });

  it('WEB-37 touch no reemplaza los tokens que guarda al mismo tiempo una renovación', async () => {
    const now = new Date();
    const original = sessionData({}, now);
    await store().set('sid-1', original);
    const renewed = { ...original, ...tokenPair('2', now) };
    await Promise.all([store().touch('sid-1', now), store().set('sid-1', renewed)]);
    expect(await store().get('sid-1')).toMatchObject({
      accessToken: renewed.accessToken,
      refreshToken: renewed.refreshToken,
    });
  });

  it('WEB-37 touch no revive una sesión que se cierra al mismo tiempo', async () => {
    await store().set('sid-1', sessionData());
    await Promise.all([store().touch('sid-1', new Date()), store().delete('sid-1')]);
    expect(await client.exists(`${SESSION_KEY_PREFIX}sid-1`)).toBe(0);
  });

  it('WEB-37 touch de una sesión ya cerrada no deja nada en Redis', async () => {
    await store().set('sid-1', sessionData());
    await store().delete('sid-1');
    await store().touch('sid-1', new Date());
    expect(await client.exists(`${SESSION_KEY_PREFIX}sid-1`)).toBe(0);
  });

  it('WEB-37 touch no extiende el TTL más allá de la vigencia absoluta del refresh', async () => {
    const now = new Date();
    const deadline = new Date(now.getTime() + 2 * MINUTE).toISOString();
    await store().set('sid-1', sessionData({ refreshTokenExpiresAt: deadline }, now));
    await store().touch('sid-1', now);
    expect(await client.pTTL(`${SESSION_KEY_PREFIX}sid-1`)).toBeLessThanOrEqual(2 * MINUTE);
  });

  it('WEB-37 comparte una conexión por proceso', async () => {
    const first = redisClient(url);
    expect(redisClient(url)).toBe(first);
    expect(await (await first).ping()).toBe('PONG');
  });
});
