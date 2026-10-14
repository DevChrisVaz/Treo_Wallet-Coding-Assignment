/*
 * Regreso tras iniciar sesión (WEB-22): `next` solo acepta rutas de esta misma web. Se rechaza todo
 * lo que un navegador podría interpretar como otro origen (`//host`, `/\host`, esquemas) y los
 * caracteres de control.
 */

const INTERNAL_PATH = /^\/(?![/\\])[^\s\\]*$/;
const PUBLIC_PATHS = ['/login', '/register', '/verify-email'];

/** Ruta interna segura para volver, o `/` (el resumen de cuentas). */
export function safeNextPath(value: unknown): string {
  if (typeof value !== 'string' || !INTERNAL_PATH.test(value)) return '/';
  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return '/';
  }
  // Caracteres de control codificados (%0d%0a) no son parte de una ruta legítima.
  if (/[\u0000-\u001f\u007f]/.test(decoded)) return '/';
  const pathname = value.split(/[?#]/, 1)[0] ?? '/';
  if (PUBLIC_PATHS.includes(pathname)) return '/';
  return value;
}

/** Inicio de sesión con la ruta de regreso y, si aplica, el aviso de sesión expirada. */
export function loginPath(next?: string | null, reason?: 'expired'): string {
  const params = new URLSearchParams();
  const target = safeNextPath(next);
  if (target !== '/') params.set('next', target);
  if (reason) params.set('reason', reason);
  const query = params.toString();
  return query ? `/login?${query}` : '/login';
}
