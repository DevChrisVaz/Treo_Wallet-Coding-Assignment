import { NetworkError } from '@devchrisvaz/wallet-contract';

import { Session } from '@/session/session';
import { createFakeApi, json } from '@/test-utils/fake-api';

import { createWalletApi, REQUEST_TIMEOUT_MS } from '../client';

const tokenPair = {
  tokenType: 'Bearer' as const,
  accessToken: 'access-1',
  accessTokenExpiresAt: '2026-10-13T17:00:00Z',
  refreshToken: 'refresh-1',
  refreshTokenExpiresAt: '2026-11-13T17:00:00Z',
};

const overview = {
  accounts: [],
  dailyLimit: {
    limit: '50000.00',
    used: '0.00',
    remaining: '50000.00',
    resetsAt: '2026-10-14T06:00:00Z',
    timeZone: 'America/Mexico_City',
  },
};

async function setup() {
  const fake = createFakeApi();
  const session = new Session();
  await session.start(tokenPair);
  const api = createWalletApi({ baseUrl: 'http://192.168.1.50:4000', session, fetch: fake.fetch });
  return { fake, session, api };
}

describe('cliente de la API', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('MOB-03 las peticiones autenticadas llevan el access token en memoria como Bearer', async () => {
    const { fake, api } = await setup();
    fake.on('GET', '/accounts', json(200, overview));
    const { data } = await api.GET('/accounts');
    expect(data).toEqual(overview);
    expect(fake.requests[0]?.headers.authorization).toBe('Bearer access-1');
    expect(fake.requests[0]?.path).toBe('/accounts');
  });

  test('MOB-10 un intento sin respuesta en 15 s se corta y se trata como pérdida de red', async () => {
    jest.useFakeTimers();
    const { fake, api } = await setup();
    fake.on('GET', '/accounts', 'hang');
    const result = api.GET('/accounts');
    const assertion = expect(result).rejects.toBeInstanceOf(NetworkError);
    await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    expect(fake.requests[0]?.signal.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    await assertion;
    expect(fake.requests[0]?.signal.aborted).toBe(true);
    expect(REQUEST_TIMEOUT_MS).toBe(15_000);
  });

  test('MOB-10 una respuesta a tiempo cancela el plazo y cada intento tiene el suyo', async () => {
    jest.useFakeTimers();
    const { fake, api } = await setup();
    fake.on('GET', '/accounts', json(200, overview));
    await api.GET('/accounts');
    expect(jest.getTimerCount()).toBe(0);
    await api.GET('/accounts');
    expect(fake.requests).toHaveLength(2);
    expect(fake.requests.every((request) => !request.signal.aborted)).toBe(true);
  });

  test('MOB-10 un error de red llega como NetworkError', async () => {
    const { fake, api } = await setup();
    fake.on('GET', '/accounts', 'network-error');
    await expect(api.GET('/accounts')).rejects.toBeInstanceOf(NetworkError);
  });
});
