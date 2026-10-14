import { NextResponse, type NextRequest } from 'next/server';

/** Header con la ruta pedida, para que el layout protegido arme `/login?next=…` (WEB-22). */
export const CURRENT_PATH_HEADER = 'x-wallet-path';

/**
 * Proxy de Next.js (antes middleware). No protege rutas, eso lo hace el layout del grupo `(app)`
 * en el servidor (D4 de web-app): solo informa la ruta pedida, reemplazando cualquier valor que
 * envíe el navegador. El destino se sanea igual antes de usarse.
 */
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(CURRENT_PATH_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ['/((?!bff/|_next/|favicon.ico).*)'],
};
