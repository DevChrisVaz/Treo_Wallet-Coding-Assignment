import 'server-only';
import type { AuthSession } from '@devchrisvaz/wallet-contract';
import { cookies } from 'next/headers';
import { SessionEndedError } from './api-client';
import {
  clearSessionCookie,
  newSessionId,
  readSessionId,
  writeSessionCookie,
} from './session-cookie';
import { sessionStore, type SessionData } from './session-store';

type CookieJar = Awaited<ReturnType<typeof cookies>>;

/** Sesión activa de la cookie; renueva su plazo de inactividad (WEB-03). */
export async function currentSession(): Promise<{
  sessionId: string;
  session: SessionData;
} | null> {
  const sessionId = readSessionId(await cookies());
  if (!sessionId) return null;
  const store = sessionStore();
  const session = await store.get(sessionId);
  if (!session) return null;
  await store.touch(sessionId, new Date());
  return { sessionId, session };
}

/** Igual que `currentSession`, pero sin sesión falla con `UNAUTHENTICATED` (WEB-07, WEB-22). */
export async function requireSession(): Promise<{ sessionId: string; session: SessionData }> {
  const current = await currentSession();
  if (!current) throw new SessionEndedError('UNAUTHENTICATED');
  return current;
}

/**
 * Inicia la sesión con los tokens que respondió la API (login o verificación de correo): los guarda
 * en el servidor con un id nuevo y emite la cookie con ese id. Descarta la sesión anterior del
 * navegador, si la había. Los tokens nunca salen del servidor (WEB-01).
 */
export async function startSession(auth: AuthSession, jar?: CookieJar): Promise<void> {
  const store = jar ?? (await cookies());
  const previous = readSessionId(store);
  if (previous) await sessionStore().delete(previous);
  const sessionId = newSessionId();
  const now = new Date().toISOString();
  await sessionStore().set(sessionId, {
    userId: auth.user.id,
    user: auth.user,
    accessToken: auth.tokens.accessToken,
    accessTokenExpiresAt: auth.tokens.accessTokenExpiresAt,
    refreshToken: auth.tokens.refreshToken,
    refreshTokenExpiresAt: auth.tokens.refreshTokenExpiresAt,
    createdAt: now,
    lastSeenAt: now,
  });
  writeSessionCookie(store, sessionId);
}

/** Cierra la sesión local: la elimina del servidor y borra la cookie. */
export async function endLocalSession(jar?: CookieJar): Promise<void> {
  const store = jar ?? (await cookies());
  const sessionId = readSessionId(store);
  if (sessionId) await sessionStore().delete(sessionId);
  clearSessionCookie(store);
}
