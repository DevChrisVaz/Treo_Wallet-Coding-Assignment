import pg from 'pg';

/** Ejecuta `fn` con un cliente `pg` conectado a `url` y lo cierra al terminar. */
export async function withClient<T>(
  url: string,
  fn: (client: pg.Client) => Promise<T>,
): Promise<T> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Devuelve el SQLSTATE con el que falla `promise`, o lanza si no falla. */
export async function sqlState(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as { code?: string }).code ?? 'sin código';
  }
  throw new Error('La sentencia no falló');
}

/** Cliente conectado; quien lo pide lo cierra con `end()`. */
export async function connect(url: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
}
