import createClient, { type Client, type Middleware } from 'openapi-fetch';
import type { paths } from './generated/api';

export type ApiClient = Client<paths>;

export interface ApiClientOptions {
  /** URL base de la API, por ejemplo `http://localhost:3000`. */
  baseUrl: string;
  /**
   * Devuelve el access token vigente en cada petición. El cliente nunca lo guarda: el BFF lo lee
   * de la sesión del servidor y la app móvil de su memoria.
   */
  getAccessToken?: () => string | undefined | Promise<string | undefined>;
  /** Implementación de `fetch`; por defecto, la global. */
  fetch?: (input: Request) => Promise<Response>;
}

function authMiddleware(
  getAccessToken: NonNullable<ApiClientOptions['getAccessToken']>,
): Middleware {
  return {
    async onRequest({ request }) {
      const token = await getAccessToken();
      if (token) request.headers.set('Authorization', `Bearer ${token}`);
      return request;
    },
  };
}

/** Crea un cliente HTTP tipado por las rutas del contrato. */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const client = createClient<paths>({
    baseUrl: options.baseUrl,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  if (options.getAccessToken) client.use(authMiddleware(options.getAccessToken));
  return client;
}
