import { createSessionRefresher, createWalletApi } from '@/api/client';
import { createFakeApi, noContent, type FakeReply } from '@/test-utils/fake-api';
import { secureStoreMock } from '@/test-utils/native-mocks';

import { logout } from '../logout';
import { Session } from '../session';

async function setup(reply: FakeReply) {
  const fake = createFakeApi().on('POST', '/auth/logout', reply);
  const session = new Session();
  await session.start({
    tokenType: 'Bearer',
    accessToken: 'access-1',
    accessTokenExpiresAt: '2026-10-13T17:00:00Z',
    refreshToken: 'refresh-1',
    refreshTokenExpiresAt: '2026-11-13T17:00:00Z',
  });
  const options = { baseUrl: 'http://192.168.1.50:4000', session, fetch: fake.fetch };
  const api = createWalletApi({ ...options, refresher: createSessionRefresher(options) });
  return { fake, session, api };
}

describe('cierre de sesión', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('MOB-04 con red pide a la API revocar el refresh y borra los tokens locales', async () => {
    const { fake, session, api } = await setup(noContent());

    await logout(session, api);

    const [call] = fake.requestsTo('POST', '/auth/logout');
    expect(JSON.parse(call?.body ?? '')).toEqual({ refreshToken: 'refresh-1' });
    expect(secureStoreMock.entries()).toEqual({});
    expect(session.getAccessToken()).toBeUndefined();
    expect(session.getSnapshot()).toEqual({ status: 'signedOut', reason: 'logout' });
  });

  test('MOB-04 sin red borra igualmente los tokens locales', async () => {
    const { fake, session, api } = await setup('network-error');

    await expect(logout(session, api)).resolves.toBeUndefined();

    expect(fake.requestsTo('POST', '/auth/logout')).toHaveLength(1);
    expect(secureStoreMock.entries()).toEqual({});
    expect(session.getSnapshot()).toEqual({ status: 'signedOut', reason: 'logout' });
  });

  test('MOB-04 no espera a la API para borrar los tokens locales', async () => {
    jest.useFakeTimers();
    const { session, api } = await setup('hang');

    const done = logout(session, api);
    await jest.advanceTimersByTimeAsync(0);

    expect(secureStoreMock.entries()).toEqual({});
    expect(session.getSnapshot()).toEqual({ status: 'signedOut', reason: 'logout' });
    await jest.advanceTimersByTimeAsync(15_000);
    await expect(done).resolves.toBeUndefined();
  });
});
