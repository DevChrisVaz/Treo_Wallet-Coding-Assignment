import * as LocalAuthentication from 'expo-local-authentication';
import { Stack } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

import RootLayout from '@/app/_layout';
import { REFRESH_TOKEN_KEY } from '@/session/session';
import { UNLOCK_PREFERENCE_KEY } from '@/session/unlock-preference';
import { createFakeApi, json } from '@/test-utils/fake-api';
import { localAuthMock, secureStoreMock } from '@/test-utils/native-mocks';
import { TEST_TOKENS } from '@/test-utils/render-app';

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => true),
  hideAsync: jest.fn(async () => undefined),
}));
jest.mock('@/config/api-url', () => ({
  readApiUrl: () => ({ ok: true, baseUrl: 'http://192.168.1.50:4000' }),
}));

describe('layout raíz con desbloqueo biométrico', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('MOB-25 el layout raíz pide la huella antes de restaurar la sesión', async () => {
    secureStoreMock.set(REFRESH_TOKEN_KEY, 'refresh-0');
    secureStoreMock.set(UNLOCK_PREFERENCE_KEY, 'enabled');
    localAuthMock.onAuthenticate(() => new Promise(() => {}));
    const fake = createFakeApi().on('POST', '/auth/refresh', json(200, TEST_TOKENS));
    globalThis.fetch = jest.fn((input: RequestInfo | URL) =>
      fake.fetch(input instanceof Request ? input : new Request(input)),
    );

    await renderRouter(
      {
        _layout: RootLayout,
        login: () => <Text>Pantalla de inicio de sesión</Text>,
        '(app)/_layout': () => <Stack />,
        '(app)/index': () => <Text>Pantalla de saldo</Text>,
      },
      { initialUrl: '/' },
    );

    expect(await screen.findByText('TreoWallet está bloqueada')).toBeOnTheScreen();
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
    expect(fake.requests).toHaveLength(0);
  });
});
