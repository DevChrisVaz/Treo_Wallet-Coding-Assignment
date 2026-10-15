import { NetworkError, ProblemError, type TokenPair } from '@devchrisvaz/wallet-contract';

import { REFRESH_TOKEN_KEY, Session } from '@/session/session';
import { readUnlockPreference, saveUnlockPreference } from '@/session/unlock-preference';
import { createFakeApi, json, problem } from '@/test-utils/fake-api';
import { secureStoreMock } from '@/test-utils/native-mocks';

import { createSessionRefresher, createWalletApi } from '../client';

const tokens = (n: number): TokenPair => ({
  tokenType: 'Bearer',
  accessToken: `access-${n}`,
  accessTokenExpiresAt: '2026-10-13T17:00:00Z',
  refreshToken: `refresh-${n}`,
  refreshTokenExpiresAt: '2026-11-13T17:00:00Z',
});

const expired = () => problem(401, 'UNAUTHENTICATED');

/** Respuesta que llega en el siguiente ciclo, para que las peticiones se encimen. */
const later = (response: Response) => () =>
  new Promise<Response>((resolve) => setTimeout(() => resolve(response), 0));

async function setup() {
  const fake = createFakeApi();
  const session = new Session();
  await session.start(tokens(1));
  const options = { baseUrl: 'http://192.168.1.50:4000', session, fetch: fake.fetch };
  const refresher = createSessionRefresher(options);
  const api = createWalletApi({ ...options, refresher });
  return { fake, session, api, refresher };
}

describe('renovación de la sesión', () => {
  test('MOB-03 ante 401 UNAUTHENTICATED renueva, guarda el refresh nuevo y repite la petición una vez', async () => {
    const { fake, session, api } = await setup();
    fake.on('GET', '/me', expired(), json(200, { id: 'u1' }));
    fake.on('POST', '/auth/refresh', json(200, tokens(2)));

    const { data } = await api.GET('/me');

    expect(data).toEqual({ id: 'u1' });
    const refreshCalls = fake.requestsTo('POST', '/auth/refresh');
    expect(refreshCalls).toHaveLength(1);
    expect(JSON.parse(refreshCalls[0]?.body ?? '')).toEqual({ refreshToken: 'refresh-1' });
    expect(refreshCalls[0]?.headers.authorization).toBeUndefined();
    const meCalls = fake.requestsTo('GET', '/me');
    expect(meCalls.map((call) => call.headers.authorization)).toEqual([
      'Bearer access-1',
      'Bearer access-2',
    ]);
    expect(secureStoreMock.entries()).toEqual({ [REFRESH_TOKEN_KEY]: 'refresh-2' });
    expect(session.getAccessToken()).toBe('access-2');
  });

  test('MOB-03 tres peticiones con el token vencido hacen una sola renovación y se repiten con el nuevo', async () => {
    const { fake, api } = await setup();
    fake.on('GET', '/me', expired(), json(200, { id: 'u1' }));
    fake.on('GET', '/accounts', expired(), json(200, { accounts: [] }));
    fake.on('GET', '/beneficiaries', expired(), json(200, { items: [] }));
    fake.on('POST', '/auth/refresh', later(json(200, tokens(2))));

    const results = await Promise.all([
      api.GET('/me'),
      api.GET('/accounts'),
      api.GET('/beneficiaries'),
    ]);

    expect(results.map((result) => result.response.status)).toEqual([200, 200, 200]);
    expect(fake.requestsTo('POST', '/auth/refresh')).toHaveLength(1);
    const retries = fake.requests.filter(
      (request) => request.method === 'GET' && request.headers.authorization === 'Bearer access-2',
    );
    expect(retries.map((request) => request.path).sort()).toEqual([
      '/accounts',
      '/beneficiaries',
      '/me',
    ]);
  });

  test('MOB-03 una petición que falló con el token anterior se repite sin renovar otra vez', async () => {
    const { fake, api, refresher } = await setup();
    fake.on('POST', '/auth/refresh', json(200, tokens(2)));
    // La petición sale con access-1; mientras viaja, otra petición ya renovó la sesión.
    fake.on(
      'GET',
      '/me',
      async () => {
        await refresher.refresh();
        return expired();
      },
      json(200, { id: 'u1' }),
    );

    await api.GET('/me');

    expect(fake.requestsTo('POST', '/auth/refresh')).toHaveLength(1);
    expect(fake.requestsTo('GET', '/me').map((call) => call.headers.authorization)).toEqual([
      'Bearer access-1',
      'Bearer access-2',
    ]);
  });

  test('MOB-03 si la petición repetida vuelve a responder 401, no renueva por segunda vez', async () => {
    const { fake, api } = await setup();
    fake.on('GET', '/me', expired());
    fake.on('POST', '/auth/refresh', json(200, tokens(2)));
    await expect(api.GET('/me')).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(fake.requestsTo('GET', '/me')).toHaveLength(2);
    expect(fake.requestsTo('POST', '/auth/refresh')).toHaveLength(1);
  });

  test('MOB-03 con la sesión revocada borra el refresh guardado y el access en memoria', async () => {
    const { fake, session, api } = await setup();
    fake.on('GET', '/me', expired());
    fake.on('POST', '/auth/refresh', problem(401, 'SESSION_REVOKED'));

    const error = await api.GET('/me').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ProblemError);
    expect(fake.requestsTo('GET', '/me')).toHaveLength(1);
    expect(secureStoreMock.entries()).toEqual({});
    expect(session.getAccessToken()).toBeUndefined();
    expect(session.getSnapshot()).toEqual({ status: 'signedOut', reason: 'revoked' });
  });

  test('MOB-27 con la sesión revocada borra también la preferencia del desbloqueo', async () => {
    const { fake, api } = await setup();
    await saveUnlockPreference('enabled');
    fake.on('GET', '/me', expired());
    fake.on('POST', '/auth/refresh', problem(401, 'SESSION_REVOKED'));

    await api.GET('/me').catch(() => undefined);

    expect(secureStoreMock.entries()).toEqual({});
    expect(await readUnlockPreference()).toBeNull();
  });

  test('MOB-27 si la renovación no obtiene respuesta, conserva la preferencia junto con la sesión', async () => {
    const { fake, api } = await setup();
    await saveUnlockPreference('enabled');
    fake.on('GET', '/me', expired());
    fake.on('POST', '/auth/refresh', 'network-error');

    await api.GET('/me').catch(() => undefined);

    expect(await readUnlockPreference()).toBe('enabled');
  });

  test('MOB-03 si la renovación no obtiene respuesta, conserva la sesión para reintentar con el mismo refresh', async () => {
    const { fake, session, api } = await setup();
    fake.on('GET', '/me', expired());
    fake.on('POST', '/auth/refresh', 'network-error');

    await expect(api.GET('/me')).rejects.toBeInstanceOf(NetworkError);

    expect(secureStoreMock.entries()).toEqual({ [REFRESH_TOKEN_KEY]: 'refresh-1' });
    expect(session.getSnapshot()).toEqual({ status: 'signedIn' });
  });

  test('MOB-31 un 429 al renovar no cierra la sesión: el refresh sigue guardado y la petición falla con RATE_LIMITED', async () => {
    const { fake, session, api } = await setup();
    await saveUnlockPreference('enabled');
    fake.on('GET', '/me', expired());
    fake.on('POST', '/auth/refresh', problem(429, 'RATE_LIMITED', {}, { 'Retry-After': '45' }));

    await expect(api.GET('/me')).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
      retryAfter: 45,
    });

    expect(fake.requestsTo('POST', '/auth/refresh')).toHaveLength(1);
    expect(secureStoreMock.entries()[REFRESH_TOKEN_KEY]).toBe('refresh-1');
    expect(session.getSnapshot()).toEqual({ status: 'signedIn' });
    expect(await readUnlockPreference()).toBe('enabled');
  });

  test('MOB-31 con el refresh conservado, la siguiente petición renueva cuando la API ya acepta', async () => {
    const { fake, session, api } = await setup();
    fake.on('GET', '/me', expired(), expired(), json(200, { id: 'u1' }));
    fake.on(
      'POST',
      '/auth/refresh',
      problem(429, 'RATE_LIMITED', {}, { 'Retry-After': '1' }),
      json(200, tokens(2)),
    );

    await api.GET('/me').catch(() => undefined);
    const { data } = await api.GET('/me');

    expect(data).toEqual({ id: 'u1' });
    expect(fake.requestsTo('POST', '/auth/refresh')).toHaveLength(2);
    expect(JSON.parse(fake.requestsTo('POST', '/auth/refresh')[1]?.body ?? '')).toEqual({
      refreshToken: 'refresh-1',
    });
    expect(session.getSnapshot()).toEqual({ status: 'signedIn' });
  });

  test('MOB-03 un 401 que no es UNAUTHENTICATED no dispara la renovación', async () => {
    const { fake, api } = await setup();
    fake.on('POST', '/auth/login', problem(401, 'INVALID_CREDENTIALS'));
    await expect(
      api.POST('/auth/login', { body: { email: 'ana@example.com', password: 'x' } }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(fake.requestsTo('POST', '/auth/refresh')).toHaveLength(0);
  });
});
