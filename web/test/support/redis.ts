/** Un puerto donde nada escucha: la conexión a Redis se rechaza de inmediato. */
export const DOWN_REDIS_URL = 'redis://127.0.0.1:1';

/**
 * Redis de las pruebas (D6 de web-redis-sessions). Sin `TEST_REDIS_URL` las pruebas de Redis se
 * saltan, salvo en CI, donde es obligatoria. Nunca la base 0, la de las sesiones de desarrollo:
 * las pruebas escriben y borran llaves de sesión.
 */
export const TEST_REDIS_URL = testRedisUrl();

function testRedisUrl(): string | undefined {
  const url = process.env.TEST_REDIS_URL?.trim();
  if (!url) {
    if (process.env.CI) {
      throw new Error('TEST_REDIS_URL es obligatoria en CI: las pruebas de Redis no se saltan ahí');
    }
    return undefined;
  }
  if (['', '/', '/0'].includes(new URL(url).pathname)) {
    throw new Error(
      'TEST_REDIS_URL debe apuntar a una base distinta de la 0, la de las sesiones de desarrollo; ' +
        'por ejemplo redis://localhost:6379/15',
    );
  }
  return url;
}
