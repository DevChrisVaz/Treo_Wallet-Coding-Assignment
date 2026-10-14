import { ProblemError } from '@devchrisvaz/wallet-contract';

export type QueryParams = Record<string, string | readonly string[] | undefined>;

function toSearch(params: QueryParams): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    for (const item of typeof value === 'string' ? [value] : value) search.append(key, item);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

/**
 * Lectura por el proxy GET del BFF (WEB-09). La cookie de sesión viaja sola (mismo origen) y el
 * Bearer lo agrega el servidor. Un error con respuesta llega como `ProblemError`; un fallo de red
 * se propaga tal cual.
 */
export async function bffGet<T>(path: string, params: QueryParams = {}): Promise<T> {
  const response = await fetch(`/bff/api/${path}${toSearch(params)}`, {
    method: 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json, application/problem+json' },
  });
  if (response.ok) return (await response.json()) as T;
  let body: Record<string, unknown> = { code: 'INTERNAL_ERROR', title: 'Error inesperado' };
  try {
    const parsed: unknown = await response.json();
    if (parsed && typeof parsed === 'object') body = parsed as Record<string, unknown>;
  } catch {
    // Cuerpo ilegible: se informa como error interno con el estado de la respuesta.
  }
  throw new ProblemError(response.status, body, response.headers.get('X-Request-Id'));
}
