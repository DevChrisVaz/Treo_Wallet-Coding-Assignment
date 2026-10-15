import { Session } from '@/session/session';
import { createServices } from '@/app-services';
import { createFakeApi, json } from '@/test-utils/fake-api';

import { createSessionRefresher, createWalletApi } from '../client';
import { appUserAgent } from '../user-agent';

const tokens = {
  tokenType: 'Bearer' as const,
  accessToken: 'access-1',
  accessTokenExpiresAt: '2026-10-13T17:00:00Z',
  refreshToken: 'refresh-1',
  refreshTokenExpiresAt: '2026-11-13T17:00:00Z',
};

describe('appUserAgent', () => {
  test('MOB-32 tiene la forma TreoWallet-App/<versión> (<sistema>)', () => {
    expect(appUserAgent('1.2.3', 'android')).toBe('TreoWallet-App/1.2.3 (android)');
    expect(appUserAgent('1.2.3', 'ios')).toBe('TreoWallet-App/1.2.3 (ios)');
  });

  test('MOB-32 solo contiene la versión y el sistema, nunca algo que venga del dispositivo', () => {
    expect(appUserAgent('1.0.0 (Pixel 8; id=abc)', 'android')).toBe(
      'TreoWallet-App/0.0.0 (android)',
    );
    expect(appUserAgent(undefined, 'ios')).toBe('TreoWallet-App/0.0.0 (ios)');
  });

  test('MOB-32 fuera de iOS y Android no hay valor', () => {
    expect(appUserAgent('1.0.0', 'web')).toBeUndefined();
  });
});

describe('User-Agent de la app en las peticiones', () => {
  const UA = 'TreoWallet-App/1.0.0 (android)';

  test('MOB-32 las peticiones de la API y la renovación llevan el User-Agent de la app', async () => {
    const fake = createFakeApi();
    const session = new Session();
    await session.start(tokens);
    const options = {
      baseUrl: 'http://192.168.1.50:4000',
      session,
      fetch: fake.fetch,
      userAgent: UA,
    };
    const refresher = createSessionRefresher(options);
    const api = createWalletApi({ ...options, refresher });
    fake.on('GET', '/me', json(200, { id: 'u1' }));
    fake.on('POST', '/auth/login', json(200, { ok: true }));

    await api.GET('/me');
    await api
      .POST('/auth/login', { body: { email: 'ana@example.com', password: 'x' } })
      .catch(() => undefined);

    for (const request of fake.requests) expect(request.headers['user-agent']).toBe(UA);
  });

  test('MOB-32 la renovación del access token lleva el mismo User-Agent', async () => {
    const fake = createFakeApi();
    const session = new Session();
    await session.start(tokens);
    const options = {
      baseUrl: 'http://192.168.1.50:4000',
      session,
      fetch: fake.fetch,
      userAgent: UA,
    };
    const refresher = createSessionRefresher(options);
    fake.on('POST', '/auth/refresh', json(200, tokens));

    await refresher.refresh();

    expect(fake.requestsTo('POST', '/auth/refresh')[0]?.headers['user-agent']).toBe(UA);
  });

  test('MOB-32 los servicios de la app arman el User-Agent con la versión y el sistema del dispositivo', async () => {
    const fake = createFakeApi();
    const services = createServices('http://192.168.1.50:4000', fake.fetch, { testing: true });
    fake.on('GET', '/me', json(200, { id: 'u1' }));

    await services.api.GET('/me');

    expect(fake.requests[0]?.headers['user-agent']).toMatch(
      /^TreoWallet-App\/[0-9A-Za-z.+-]+ \((ios|android)\)$/,
    );
  });
});
