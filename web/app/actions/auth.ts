'use server';

import { loginForm, registerForm, verifyEmailForm, type User } from '@devchrisvaz/wallet-contract';
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
 * Registro (WEB-11). La API responde 202 con el mismo mensaje exista o no el correo; la interfaz
 * muestra siempre el mismo texto y pasa a la verificación.
 */
export async function register(input: unknown): Promise<ActionResult<{ message: string }>> {
  return publicAction(registerForm, input, async ({ data, api }) => {
    const { data: accepted } = await api.POST('/auth/register', { body: data });
    return { message: accepted?.message ?? '' };
  });
}

/** Verifica el correo con el código de 6 dígitos e inicia la sesión con los tokens recibidos. */
export async function verifyEmail(input: unknown): Promise<ActionResult<{ user: User }>> {
  return publicAction(verifyEmailForm, input, async ({ data, api, cookies }) => {
    const { data: auth } = await api.POST('/auth/verify-email', { body: data });
    if (!auth) throw new Error('verifyEmail respondió sin sesión');
    await startSession(auth, cookies);
    return { user: auth.user };
  });
}

const resendVerificationForm = verifyEmailForm.pick({ email: true });

/** Pide un código nuevo; la API responde 202 siempre. */
export async function resendVerification(
  input: unknown,
): Promise<ActionResult<{ message: string }>> {
  return publicAction(resendVerificationForm, input, async ({ data, api }) => {
    const { data: accepted } = await api.POST('/auth/verify-email/resend', { body: data });
    return { message: accepted?.message ?? '' };
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
