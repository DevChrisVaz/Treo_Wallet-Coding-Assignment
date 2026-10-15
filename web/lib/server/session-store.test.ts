import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { USER } from '@/test/fixtures';
import { describeSessionStoreContract } from '@/test/support/session-store-contract';
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

describeSessionStoreContract('Memoria', () => ({
  idleMs: 15 * MINUTE,
  create: () => createMemorySessionStore({ idleMs: 15 * MINUTE }),
  advance: async (ms) => {
    vi.advanceTimersByTime(ms);
  },
}));

describe('createMemorySessionStore', () => {
  it('WEB-03 activa a los 14 minutos; pasados los 15 se descarta y sale del Map', async () => {
    const map = new Map<string, SessionData>();
    const store = createMemorySessionStore({ idleMs: 15 * MINUTE, map });
    await store.set('sid-1', session());
    vi.advanceTimersByTime(14 * MINUTE);
    expect(await store.get('sid-1')).toMatchObject({ userId: USER.id });
    vi.advanceTimersByTime(MINUTE + 1);
    expect(await store.get('sid-1')).toBeNull();
    expect(map.has('sid-1')).toBe(false);
  });

  it('WEB-03 touch de una sesión inexistente no agrega nada al Map', async () => {
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
