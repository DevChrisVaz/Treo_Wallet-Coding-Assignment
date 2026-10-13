import * as z from 'zod';

/**
 * Configuración del servidor de la web. Se valida al arrancar (`next.config.ts`) y en cada uso
 * desde `lib/server/env.ts`. No importa `server-only` porque `next.config.ts` la necesita.
 */
export interface ServerEnv {
  /** Origen de la API (`http://localhost:4000` en local). Nunca se deriva de la petición. */
  apiBaseUrl: string;
  /** Orígenes, además del propio, desde los que se aceptan Server Actions (proxies). */
  allowedOrigins: string[];
  /** `true` detrás de HTTPS: cookie `__Host-sid` con `Secure`. */
  sessionCookieSecure: boolean;
  /** Minutos de inactividad tras los que expira la sesión. */
  sessionIdleMinutes: number;
}

const LOCAL_API_BASE_URL = 'http://localhost:4000';

/** Un origen http(s) sin ruta, consulta ni fragmento; se devuelve sin la diagonal final. */
function isBareHttpOrigin(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    url.pathname === '/' &&
    url.search === '' &&
    url.hash === '' &&
    url.username === '' &&
    url.password === ''
  );
}

const origin = z
  .string()
  .trim()
  .refine(isBareHttpOrigin, 'debe ser un origen http(s) sin ruta, como https://wallet.example.com')
  .transform((value) => new URL(value).origin);

function booleanFlag(fallback: boolean) {
  // En Zod 4, `.default()` devuelve el valor sin pasar por el esquema: va antes del transform.
  return z
    .enum(['true', 'false'])
    .default(fallback ? 'true' : 'false')
    .transform((value) => value === 'true');
}

function schemaFor(production: boolean, requireApiBaseUrl: boolean) {
  return z.object({
    API_BASE_URL: requireApiBaseUrl ? origin : z.string().default(LOCAL_API_BASE_URL).pipe(origin),
    ALLOWED_ORIGINS: z
      .string()
      .default('')
      .transform((value) =>
        value
          .split(',')
          .map((item) => item.trim())
          .filter((item) => item !== ''),
      )
      .pipe(z.array(origin)),
    SESSION_COOKIE_SECURE: booleanFlag(production),
    SESSION_IDLE_MINUTES: z
      .string()
      .regex(/^[1-9][0-9]{0,3}$/, 'debe ser un entero de minutos mayor que 0')
      .default('15')
      .transform((value) => Number.parseInt(value, 10)),
  });
}

export interface ParseOptions {
  /** Por defecto, `API_BASE_URL` es obligatoria solo con `NODE_ENV=production`. */
  requireApiBaseUrl?: boolean | undefined;
}

/** Valida las variables de entorno del servidor y lanza un error que nombra cada una inválida. */
export function parseServerEnv(
  env: Record<string, string | undefined>,
  options: ParseOptions = {},
): ServerEnv {
  const production = env.NODE_ENV === 'production';
  const result = schemaFor(production, options.requireApiBaseUrl ?? production).safeParse(env);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.map(String).join('.') || 'entorno'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Configuración del servidor inválida. ${details}`);
  }
  const data = result.data;
  return {
    apiBaseUrl: data.API_BASE_URL,
    allowedOrigins: data.ALLOWED_ORIGINS,
    sessionCookieSecure: data.SESSION_COOKIE_SECURE,
    sessionIdleMinutes: data.SESSION_IDLE_MINUTES,
  };
}

/**
 * `serverActions.allowedOrigins` de Next.js compara el host (con puerto) del `Origin`, no el
 * origen completo.
 */
export function allowedOriginHosts(origins: readonly string[]): string[] {
  return origins.map((value) => new URL(value).host);
}
