/**
 * Sustituto de `next/headers` para probar Server Actions y route handlers fuera de Next.js:
 * `vi.mock('next/headers', () => import('@/test/support/next-headers'))`.
 */

export interface CookieWrite {
  name: string;
  value: string;
  options: Record<string, unknown> | undefined;
}

const state = {
  headers: new Headers(),
  cookies: new Map<string, string>(),
  writes: [] as CookieWrite[],
};

const cookieStore = {
  get(name: string) {
    const value = state.cookies.get(name);
    return value === undefined ? undefined : { name, value };
  },
  set(name: string, value: string, options?: Record<string, unknown>) {
    state.writes.push({ name, value, options });
    const expired = options?.expires instanceof Date && options.expires.getTime() <= Date.now();
    if (expired || value === '') state.cookies.delete(name);
    else state.cookies.set(name, value);
    return cookieStore;
  },
  delete(name: string) {
    state.writes.push({ name, value: '', options: { expires: new Date(0) } });
    state.cookies.delete(name);
    return cookieStore;
  },
};

export async function headers() {
  return state.headers;
}

export async function cookies() {
  return cookieStore;
}

/** Reinicia la petición simulada con estos headers y cookies del navegador. */
export function resetRequest({
  headers: incoming = {},
  cookies: incomingCookies = {},
}: { headers?: Record<string, string>; cookies?: Record<string, string> } = {}) {
  state.headers = new Headers(incoming);
  state.cookies = new Map(Object.entries(incomingCookies));
  state.writes = [];
}

/** Cookies que el servidor escribió en la respuesta (Set-Cookie). */
export function cookieWrites(): CookieWrite[] {
  return state.writes;
}

/** Valor actual de una cookie tras las escrituras del servidor. */
export function cookieValue(name: string): string | undefined {
  return state.cookies.get(name);
}
