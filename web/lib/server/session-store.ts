import 'server-only';
import type { User } from '@devchrisvaz/wallet-contract';
import { serverEnv } from './env';
import { createRedisSessionStore, redisClient } from './redis-session-store';

/** Lo que el servidor guarda de cada sesión. Nada de esto llega al navegador (WEB-01). */
export interface SessionData {
  userId: string;
  /** Datos del usuario para `GET /bff/api/session`, sin tokens. */
  user: User;
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  createdAt: string;
  lastSeenAt: string;
}

/**
 * Puerto de almacenamiento de sesiones (D2 de web-app): un `Map` en memoria o Redis con TTL
 * renovado en cada acceso (`redis-session-store.ts`), en local con `REDIS_URL` y en AWS.
 */
export interface SessionStore {
  /** Devuelve la sesión o `null`; la descarta si venció por inactividad o por su vigencia absoluta. */
  get(id: string): Promise<SessionData | null>;
  set(id: string, data: SessionData): Promise<void>;
  /** Renueva el plazo de inactividad. */
  touch(id: string, now: Date): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface MemorySessionStoreOptions {
  idleMs: number;
  map?: Map<string, SessionData>;
}

function isExpired(data: SessionData, idleMs: number, now: number): boolean {
  const idleFor = now - Date.parse(data.lastSeenAt);
  return idleFor > idleMs || now >= Date.parse(data.refreshTokenExpiresAt);
}

/** Implementación en memoria: la expiración se evalúa al leer. */
export function createMemorySessionStore({
  idleMs,
  map = new Map(),
}: MemorySessionStoreOptions): SessionStore {
  return {
    async get(id) {
      const data = map.get(id);
      if (!data) return null;
      if (isExpired(data, idleMs, Date.now())) {
        map.delete(id);
        return null;
      }
      return data;
    },
    async set(id, data) {
      map.set(id, data);
    },
    async touch(id, now) {
      const data = map.get(id);
      if (data) map.set(id, { ...data, lastSeenAt: now.toISOString() });
    },
    async delete(id) {
      map.delete(id);
    },
  };
}

// El Map vive en globalThis para sobrevivir a la recarga de módulos del servidor de desarrollo.
const globalSessions = globalThis as typeof globalThis & {
  __treoWalletSessions?: Map<string, SessionData>;
};

function sessionsMap(): Map<string, SessionData> {
  globalSessions.__treoWalletSessions ??= new Map();
  return globalSessions.__treoWalletSessions;
}

/**
 * Almacén de sesiones con el plazo de `SESSION_IDLE_MINUTES`: Redis si hay `REDIS_URL` (las
 * sesiones sobreviven al reinicio del servidor, WEB-37); si no, el Map del proceso.
 */
export function sessionStore(): SessionStore {
  const { redisUrl, sessionIdleMinutes } = serverEnv();
  const idleMs = sessionIdleMinutes * 60_000;
  if (redisUrl) {
    return createRedisSessionStore({ connection: () => redisClient(redisUrl), idleMs });
  }
  return createMemorySessionStore({ idleMs, map: sessionsMap() });
}
