import { vi } from 'vitest';

type Handler = (request: Request) => Response | Promise<Response>;

interface Route {
  method: string;
  path: string | RegExp;
  handle: Handler;
}

export interface RecordedCall {
  method: string;
  url: URL;
  headers: Headers;
  body: unknown;
}

/**
 * Simula la API sustituyendo el `fetch` global. Registra cada llamada (método, URL, headers y
 * cuerpo) y responde con el manejador de la ruta; una ruta sin manejador falla la prueba.
 */
export function fakeApi() {
  const routes: Route[] = [];
  const calls: RecordedCall[] = [];

  const fetchMock = vi.fn(async (input: Request | string | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    const text = await request.clone().text();
    calls.push({
      method: request.method,
      url,
      headers: new Headers(request.headers),
      body: text ? (JSON.parse(text) as unknown) : undefined,
    });
    const route = routes.find(
      (candidate) =>
        candidate.method === request.method &&
        (typeof candidate.path === 'string'
          ? candidate.path === url.pathname
          : candidate.path.test(url.pathname)),
    );
    if (!route) throw new Error(`Llamada inesperada a la API: ${request.method} ${url.pathname}`);
    return route.handle(request);
  });

  vi.stubGlobal('fetch', fetchMock);

  return {
    calls,
    fetch: fetchMock,
    on(method: string, path: string | RegExp, handle: Handler) {
      routes.push({ method, path, handle });
      return this;
    },
    callsTo(method: string, path: string) {
      return calls.filter((call) => call.method === method && call.url.pathname === path);
    },
  };
}

export function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'api-req', ...headers },
  });
}

export function problemResponse(
  status: number,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  return new Response(JSON.stringify({ type: 'about:blank', title: 'Error', status, ...body }), {
    status,
    headers: {
      'Content-Type': 'application/problem+json',
      'X-Request-Id': 'api-req',
      ...headers,
    },
  });
}

/** Respuesta que se resuelve cuando la prueba lo indica, para provocar concurrencia. */
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
