import type { SessionData } from '@/lib/server/session-store';
import { USER } from '@/test/fixtures';

export const SESSION_ID = 'S'.repeat(43);

/** Sesión del servidor con un access token vigente por 10 minutos desde `now`. */
export function sessionData(overrides: Partial<SessionData> = {}, now = new Date()): SessionData {
  const inMinutes = (minutes: number) => new Date(now.getTime() + minutes * 60_000).toISOString();
  return {
    userId: USER.id,
    user: USER,
    accessToken: 'access-token-1',
    accessTokenExpiresAt: inMinutes(10),
    refreshToken: 'refresh-token-1-'.padEnd(43, 'r'),
    refreshTokenExpiresAt: inMinutes(7 * 24 * 60),
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    ...overrides,
  };
}

/** Par de tokens nuevo como lo responde `refreshSession`. */
export function tokenPair(suffix: string, now = new Date()) {
  return {
    tokenType: 'Bearer' as const,
    accessToken: `access-token-${suffix}`,
    accessTokenExpiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
    refreshToken: `refresh-token-${suffix}-`.padEnd(43, 'r'),
    refreshTokenExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60_000).toISOString(),
  };
}
