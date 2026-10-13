'use server';

import { loginForm, type User } from '@devchrisvaz/wallet-contract';
import type { ActionResult } from '@/lib/action-result';
import { publicAction } from '@/lib/server/action';
import { logUnexpectedError } from '@/lib/server/log';
import { readSessionId } from '@/lib/server/session-cookie';
import { sessionStore } from '@/lib/server/session-store';
import { endLocalSession, startSession } from '@/lib/server/session';

/**
 * Inicia sesión (WEB-12). Los tokens se guardan en el servidor y el navegador solo recibe la
 * cookie con el id de sesión y los datos del usuario (WEB-01).
 */
export async function login(input: unknown): Promise<ActionResult<{ user: User }>> {
  return publicAction(loginForm, input, async ({ data, api, cookies }) => {
    const { data: auth } = await api.POST('/auth/login', { body: data });
    if (!auth) throw new Error('login respondió sin sesión');
    await startSession(auth, cookies);
    return { user: auth.user };
  });
}

/**
 * Cierra la sesión (WEB-05): pide a la API revocar la familia del refresh y, responda o no,
 * elimina la sesión del servidor y borra la cookie.
 */
export async function logout(): Promise<ActionResult<null>> {
  return publicAction(null, undefined, async ({ api, cookies, request }) => {
    const sessionId = readSessionId(cookies);
    const session = sessionId ? await sessionStore().get(sessionId) : null;
    if (session) {
      try {
        await api.POST('/auth/logout', { body: { refreshToken: session.refreshToken } });
      } catch (error) {
        // El cierre local no depende de la API.
        logUnexpectedError(request.requestId, error);
      }
    }
    await endLocalSession(cookies);
    return null;
  });
}
