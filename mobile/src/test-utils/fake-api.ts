/**
 * API simulada para las pruebas: se le pasa al cliente como `fetch`. Registra cada petición (con su
 * cuerpo exacto) y responde con la secuencia de respuestas configurada por ruta. Ninguna prueba
 * depende de la API real.
 */
export type FakeReply = Response | 'network-error' | 'hang' | (() => Response | Promise<Response>);

export interface RecordedRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string | undefined;
  signal: AbortSignal;
}

interface Route {
  method: string;
  path: RegExp;
  replies: FakeReply[];
}

export function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

export function noContent() {
  return new Response(null, { status: 204 });
}

export function problem(
  status: number,
  code: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return new Response(
    JSON.stringify({
      type: `/problems/${code.toLowerCase()}`,
      title: 'Título técnico que la app no muestra',
      detail: 'Detalle técnico que la app no muestra',
      status,
      code,
      requestId: 'req-test-1',
      ...extra,
    }),
    { status, headers: { 'Content-Type': 'application/problem+json', ...headers } },
  );
}

export function createFakeApi() {
  const routes: Route[] = [];
  const requests: RecordedRequest[] = [];

  async function reply(next: FakeReply, request: Request): Promise<Response> {
    if (next === 'network-error') throw new TypeError('Network request failed');
    if (next === 'hang') {
      return new Promise<Response>((_, reject) => {
        request.signal.addEventListener('abort', () => reject(new TypeError('Aborted')));
      });
    }
    return typeof next === 'function' ? next() : next.clone();
  }

  const fetch = async (request: Request): Promise<Response> => {
    const url = new globalThis.URL(request.url);
    const body = request.method === 'GET' ? undefined : (await request.clone().text()) || undefined;
    const recorded: RecordedRequest = {
      method: request.method,
      path: `${url.pathname}${url.search}`,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      signal: request.signal,
    };
    requests.push(recorded);
    const route = routes.find(
      (candidate) => candidate.method === request.method && candidate.path.test(url.pathname),
    );
    if (!route) throw new Error(`Ruta sin respuesta simulada: ${request.method} ${url.pathname}`);
    const next = route.replies.length > 1 ? route.replies.shift() : route.replies[0];
    return reply(next as FakeReply, request);
  };

  return {
    fetch,
    requests,
    /** Respuestas en orden para una ruta; la última se repite. */
    on(method: string, path: string | RegExp, ...replies: FakeReply[]) {
      const pattern = typeof path === 'string' ? new RegExp(`^${path}$`) : path;
      routes.unshift({ method, path: pattern, replies });
      return this;
    },
    requestsTo(method: string, path: string | RegExp) {
      const pattern = typeof path === 'string' ? new RegExp(`^${path}$`) : path;
      return requests.filter(
        (request) => request.method === method && pattern.test(request.path.split('?')[0] ?? ''),
      );
    },
  };
}

export type FakeApi = ReturnType<typeof createFakeApi>;
