import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { USER } from '@/test/fixtures';
import { createMemorySessionStore, sessionStore, type SessionData } from './session-store';

const MINUTE = 60_000;
const START = new Date('2026-10-13T16:00:00.000Z');

function session(overrides: Partial<SessionData> = {}): SessionData {
  return {
    userId: USER.id,
    user: USER,
    accessToken: 'access-1',
    accessTokenExpiresAt: '2026-10-13T16:10:00.000Z',
    refreshToken: 'refresh-1'.padEnd(43, 'x'),
    refreshTokenExpiresAt: '2026-10-20T16:00:00.000Z',
    createdAt: START.toISOString(),
    lastSeenAt: START.toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createMemorySessionStore', () => {
  it('WEB-03 la sesión sigue activa a los 14 minutos de la última petición', async () => {
    const store = createMemorySessionStore({ idleMs: 15 * MINUTE });
    await store.set('sid-1', session());
    vi.advanceTimersByTime(14 * MINUTE);
    expect(await store.get('sid-1')).toMatchObject({ userId: USER.id });
  });

  it('WEB-03 touch renueva el plazo: activa 28 minutos después si hubo actividad a los 14', async () => {
    const store = createMemorySessionStore({ idleMs: 15 * MINUTE });
    await store.set('sid-1', session());
    vi.advanceTimersByTime(14 * MINUTE);
    await store.touch('sid-1', new Date());
    vi.advanceTimersByTime(14 * MINUTE);
    const data = await store.get('sid-1');
    expect(data?.lastSeenAt).toBe('2026-10-13T16:14:00.000Z');
  });

  it('WEB-03 tras más de 15 minutos sin peticiones la sesión se descarta', async () => {
    const map = new Map<string, SessionData>();
    const store = createMemorySessionStore({ idleMs: 15 * MINUTE, map });
    await store.set('sid-1', session());
    vi.advanceTimersByTime(15 * MINUTE + 1);
    expect(await store.get('sid-1')).toBeNull();
    expect(map.has('sid-1')).toBe(false);
  });

  it('WEB-03 la sesión expira cuando la familia del refresh alcanza su vigencia absoluta', async () => {
    const store = createMemorySessionStore({ idleMs: 15 * MINUTE });
    await store.set('sid-1', session({ refreshTokenExpiresAt: '2026-10-13T16:05:00.000Z' }));
    vi.advanceTimersByTime(5 * MINUTE);
    await store.touch('sid-1', new Date());
    expect(await store.get('sid-1')).toBeNull();
  });

  it('WEB-05 delete elimina la sesión', async () => {
    const store = createMemorySessionStore({ idleMs: 15 * MINUTE });
    await store.set('sid-1', session());
    await store.delete('sid-1');
    expect(await store.get('sid-1')).toBeNull();
  });

  it('WEB-03 touch de una sesión inexistente no la crea', async () => {
    const map = new Map<string, SessionData>();
    const store = createMemorySessionStore({ idleMs: 15 * MINUTE, map });
    await store.touch('no-existe', new Date());
    expect(map.size).toBe(0);
  });
});

describe('sessionStore', () => {
  it('WEB-03 usa SESSION_IDLE_MINUTES para el plazo de inactividad', async () => {
    vi.stubEnv('SESSION_IDLE_MINUTES', '5');
    const store = sessionStore();
    await store.set('sid-env', session());
    vi.advanceTimersByTime(5 * MINUTE + 1);
    expect(await store.get('sid-env')).toBeNull();
  });

  it('WEB-01 guarda las sesiones en globalThis: sobreviven a recargar el módulo', async () => {
    await sessionStore().set('sid-global', session());
    vi.resetModules();
    const reloaded = await import('./session-store');
    expect(await reloaded.sessionStore().get('sid-global')).toMatchObject({ userId: USER.id });
    await reloaded.sessionStore().delete('sid-global');
  });
});
