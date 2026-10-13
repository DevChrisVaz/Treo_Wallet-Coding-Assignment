import 'server-only';
import { randomBytes } from 'node:crypto';
import { serverEnv } from './env';

/*
 * Cookie de sesión (D8 de web-app, WEB-02). Solo lleva un id opaco; los tokens viven en el
 * SessionStore. Sin Max-Age: la expiración real la decide el servidor.
 *
 * | Entorno | Nombre       | Atributos                                  |
 * | HTTPS   | `__Host-sid` | HttpOnly; Secure; SameSite=Strict; Path=/  |
 * | local   | `sid`        | HttpOnly; SameSite=Strict; Path=/          |
 */

export interface CookieOptions {
  /** Por defecto, `SESSION_COOKIE_SECURE`. */
  secure?: boolean;
}

/** Parte de `cookies()` de Next.js (Server Actions y route handlers) que se usa para escribir. */
export interface CookieWriter {
  set(
    name: string,
    value: string,
    options?: {
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: 'strict';
      path?: string;
      expires?: Date;
    },
  ): unknown;
}

export interface CookieReader {
  get(name: string): { value: string } | undefined;
}

const SESSION_ID = /^[A-Za-z0-9_-]{43}$/;

function isSecure(options: CookieOptions): boolean {
  return options.secure ?? serverEnv().sessionCookieSecure;
}

export function sessionCookieName(secure: boolean): '__Host-sid' | 'sid' {
  return secure ? '__Host-sid' : 'sid';
}

function attributes(secure: boolean) {
  return { httpOnly: true, secure, sameSite: 'strict', path: '/' } as const;
}

/** Emite la cookie con el id de sesión. */
export function writeSessionCookie(
  cookies: CookieWriter,
  sessionId: string,
  options: CookieOptions = {},
): void {
  const secure = isSecure(options);
  cookies.set(sessionCookieName(secure), sessionId, attributes(secure));
}

/** Borra la cookie con los mismos atributos; sin ellos el navegador rechaza borrar `__Host-`. */
export function clearSessionCookie(cookies: CookieWriter, options: CookieOptions = {}): void {
  const secure = isSecure(options);
  cookies.set(sessionCookieName(secure), '', { ...attributes(secure), expires: new Date(0) });
}

/** Id de sesión de la cookie, solo si tiene la forma de uno emitido por `newSessionId`. */
export function readSessionId(
  cookies: CookieReader,
  options: CookieOptions = {},
): string | undefined {
  const value = cookies.get(sessionCookieName(isSecure(options)))?.value;
  return value && SESSION_ID.test(value) ? value : undefined;
}

/** 32 bytes aleatorios en base64url. */
export function newSessionId(): string {
  return randomBytes(32).toString('base64url');
}
