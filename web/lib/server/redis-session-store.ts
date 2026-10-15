import 'server-only';
import { createClient } from 'redis';
import type { SessionData, SessionStore } from './session-store';

/*
 * SessionStore en Redis (WEB-37, D3 a D5 de web-redis-sessions). Cada sesión es un hash:
 *
 * | Campo        | Valor                                                  |
 * | `data`       | La sesión en JSON, sin `lastSeenAt`                    |
 * | `lastSeenAt` | Última petición (ISO 8601); solo la cambia `touch`     |
 * | `deadline`   | Vencimiento del refresh token, en milisegundos         |
 *
 * El TTL es el plazo menor entre `lastSeenAt` + inactividad y `deadline`: Redis borra solo las
 * sesiones vencidas.
 */

export type RedisClient = ReturnType<typeof createClient>;

/** Separa las sesiones de lo demás que guarde el mismo Redis (en AWS, los contadores, D5 de delivery). */
export const SESSION_KEY_PREFIX = 'treo:web:session:';

/**
 * Renueva el plazo sin reescribir `data`, para no devolver a la sesión un refresh ya rotado por una
 * renovación concurrente (IDN-12), y sin volver a crear una sesión que expiró o se cerró (D4).
 * ARGV: lastSeenAt, plazo de inactividad (ms), ahora (ms).
 */
const TOUCH_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
local deadline = tonumber(redis.call('HGET', KEYS[1], 'deadline'))
local ttl = deadline and math.min(tonumber(ARGV[2]), deadline - tonumber(ARGV[3])) or 0
if ttl <= 0 then
  redis.call('DEL', KEYS[1])
  return 0
end
redis.call('HSET', KEYS[1], 'lastSeenAt', ARGV[1])
redis.call('PEXPIRE', KEYS[1], ttl)
return 1
`;

export interface RedisSessionStoreOptions {
  /** Conexión lista para usar; se pide en cada operación para conectar al primer uso. */
  connection: () => Promise<RedisClient>;
  idleMs: number;
}

/** Milisegundos en que vence la sesión: el plazo menor entre inactividad y vigencia absoluta. */
function expiresAt(lastSeenAt: string, deadline: number, idleMs: number): number {
  return Math.min(Date.parse(lastSeenAt) + idleMs, deadline);
}

export function createRedisSessionStore({
  connection,
  idleMs,
}: RedisSessionStoreOptions): SessionStore {
  const keyOf = (id: string) => `${SESSION_KEY_PREFIX}${id}`;

  return {
    async get(id) {
      const client = await connection();
      const fields = await client.hGetAll(keyOf(id));
      const { data, lastSeenAt, deadline } = fields;
      if (data === undefined || lastSeenAt === undefined || deadline === undefined) return null;
      // Redis ya borra las vencidas; se vuelve a comprobar con el reloj de la web, como en memoria.
      if (Date.now() >= expiresAt(lastSeenAt, Number.parseInt(deadline, 10), idleMs)) {
        await client.del(keyOf(id));
        return null;
      }
      return { ...(JSON.parse(data) as Omit<SessionData, 'lastSeenAt'>), lastSeenAt };
    },
    async set(id, session) {
      const client = await connection();
      const { lastSeenAt, ...data } = session;
      const deadline = Date.parse(session.refreshTokenExpiresAt);
      const ttl = expiresAt(lastSeenAt, deadline, idleMs) - Date.now();
      if (ttl <= 0) {
        await client.del(keyOf(id));
        return;
      }
      await client
        .multi()
        .del(keyOf(id))
        .hSet(keyOf(id), { data: JSON.stringify(data), lastSeenAt, deadline: String(deadline) })
        .pExpire(keyOf(id), ttl)
        .exec();
    },
    async touch(id, now) {
      const client = await connection();
      await client.eval(TOUCH_SCRIPT, {
        keys: [keyOf(id)],
        arguments: [now.toISOString(), String(idleMs), String(now.getTime())],
      });
    },
    async delete(id) {
      const client = await connection();
      await client.del(keyOf(id));
    },
  };
}

function logConnectionError(error: Error): void {
  console.error(
    JSON.stringify({
      level: 'error',
      msg: 'Error de conexión con Redis',
      error: { name: error.name, message: error.message },
    }),
  );
}

/**
 * Conecta y falla rápido (D5): sin conexión, los comandos se rechazan en vez de esperar en cola;
 * al arrancar se rinde tras dos reintentos (con la estrategia por defecto, `connect()` esperaría
 * para siempre); ya conectado, se reconecta siempre con espera creciente de hasta 2 s.
 */
async function connect(url: string): Promise<RedisClient> {
  let ready = false;
  const client = createClient({
    url,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: 2_000,
      reconnectStrategy: (retries) =>
        !ready && retries >= 2 ? false : Math.min(100 * 2 ** retries, 2_000),
    },
  });
  client.on('ready', () => {
    ready = true;
  });
  client.on('error', logConnectionError);
  await client.connect();
  return client;
}

// La conexión vive en globalThis, como el Map, para que la recarga de módulos no abra otra.
const globalRedis = globalThis as typeof globalThis & {
  __treoWalletRedis?: { url: string; client: Promise<RedisClient> };
};

/** Conexión del proceso a `url`; se abre al primer uso y, si falla, el siguiente uso reintenta. */
export function redisClient(url: string): Promise<RedisClient> {
  const cached = globalRedis.__treoWalletRedis;
  if (cached?.url === url) return cached.client;
  const client = connect(url);
  globalRedis.__treoWalletRedis = { url, client };
  client.catch(() => {
    if (globalRedis.__treoWalletRedis?.client === client) delete globalRedis.__treoWalletRedis;
  });
  return client;
}

/** Cierra la conexión del proceso, si la hay. Lo usan las pruebas para simular un reinicio. */
export async function closeRedisClient(): Promise<void> {
  const cached = globalRedis.__treoWalletRedis;
  delete globalRedis.__treoWalletRedis;
  if (!cached) return;
  const client = await cached.client.catch(() => undefined);
  if (client?.isOpen) await client.close();
}
