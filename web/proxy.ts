import { NextResponse, type NextRequest } from 'next/server';
import { parseServerEnv } from './lib/config';
import { contentSecurityPolicy, newNonce } from './lib/csp';

/** Header con la ruta pedida, para que el layout protegido arme `/login?next=…` (WEB-22). */
export const CURRENT_PATH_HEADER = 'x-wallet-path';

/** Header con el nonce de la petición, para quien necesite ponerlo en un script (Next.js lo lee del CSP). */
export const NONCE_HEADER = 'x-nonce';

/**
 * ¿La cookie de sesión es segura (HTTPS)? Se lee una sola vez, en la primera petición y no al cargar
 * el módulo: `next build` también importa este archivo y todavía no exige `API_BASE_URL`.
 */
let secure: boolean | undefined;
function isSecure(): boolean {
  secure ??= parseServerEnv(process.env).sessionCookieSecure;
  return secure;
}

/**
 * Proxy de Next.js (antes middleware). No protege rutas, eso lo hace el layout del grupo `(app)`
 * en el servidor (D4 de web-app). Hace dos cosas por petición de página:
 * - informa la ruta pedida, reemplazando cualquier valor que envíe el navegador (WEB-22); el
 *   destino se sanea igual antes de usarse;
 * - genera un nonce y escribe la Content-Security-Policy en la petición (Next.js lo toma de ahí para
 *   sus scripts) y en la respuesta (WEB-39). Por eso las páginas se renderizan por petición.
 */
export function proxy(request: NextRequest) {
  const nonce = newNonce();
  const policy = contentSecurityPolicy({
    nonce,
    development: process.env.NODE_ENV === 'development',
    secure: isSecure(),
  });
  const headers = new Headers(request.headers);
  headers.set(CURRENT_PATH_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);
  headers.set(NONCE_HEADER, nonce);
  headers.set('Content-Security-Policy', policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

export const config = {
  matcher: ['/((?!bff/|_next/|favicon.ico).*)'],
};
