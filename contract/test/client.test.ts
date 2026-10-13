import { describe, expect, it } from 'vitest';
import { createApiClient } from '../src/index';
import { accountsOverview, fakeFetch } from './support/fake-fetch';

describe('createApiClient', () => {
  it('CTR-04 devuelve la respuesta de GET /accounts tipada como AccountsOverview', async () => {
    const { fetch } = fakeFetch(() => Response.json(accountsOverview));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    const { data } = await client.GET('/accounts');

    expect(data?.dailyLimit.remaining).toBe('48500.00');
    expect(data?.accounts[0]?.clabe).toBe('032180000118359719');
  });

  it('CTR-04 envía el access token como Authorization: Bearer', async () => {
    const { fetch, requests } = fakeFetch(() => Response.json(accountsOverview));
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch,
      getAccessToken: () => 'token-abc',
    });

    await client.GET('/accounts');

    expect(requests[0]?.headers.get('Authorization')).toBe('Bearer token-abc');
  });

  it('CTR-04 no guarda el token: cada petición usa el valor actual del consumidor', async () => {
    const { fetch, requests } = fakeFetch(() => Response.json(accountsOverview));
    let current = 'token-1';
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch,
      getAccessToken: async () => current,
    });

    await client.GET('/accounts');
    current = 'token-2';
    await client.GET('/accounts');

    expect(requests.map((r) => r.headers.get('Authorization'))).toEqual([
      'Bearer token-1',
      'Bearer token-2',
    ]);
  });

  it('CTR-04 no envía Authorization cuando no hay token', async () => {
    const { fetch, requests } = fakeFetch(() => Response.json({ status: 'ok' }));
    const client = createApiClient({
      baseUrl: 'http://api.test',
      fetch,
      getAccessToken: () => undefined,
    });

    await client.GET('/health');

    expect(requests[0]?.headers.has('Authorization')).toBe(false);
  });

  it('CTR-04 una ruta inexistente no compila', () => {
    const client = createApiClient({ baseUrl: 'http://api.test' });
    const callUnknownRoute = () =>
      // @ts-expect-error la ruta no existe en el contrato
      client.GET('/no-existe');

    expect(typeof callUnknownRoute).toBe('function');
  });
});
