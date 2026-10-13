import type { TokenPair } from '@devchrisvaz/wallet-contract';
import { Stack } from 'expo-router';
import { userEvent } from '@testing-library/react-native';
import { renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { AppProviders } from '@/app-services';
import { REFRESH_TOKEN_KEY } from '@/session/session';
import { createFakeApi, json, problem, type FakeApi } from '@/test-utils/fake-api';
import { secureStoreMock } from '@/test-utils/native-mocks';

import { RootNavigator } from '../root-navigator';

const tokens: TokenPair = {
  tokenType: 'Bearer',
  accessToken: 'access-1',
  accessTokenExpiresAt: '2026-10-13T17:00:00Z',
  refreshToken: 'refresh-1',
  refreshTokenExpiresAt: '2026-11-13T17:00:00Z',
};

async function openApp(fake: FakeApi) {
  const router = renderRouter(
    {
      _layout: () => (
        <AppProviders baseUrl="http://192.168.1.50:4000" fetch={fake.fetch}>
          <RootNavigator />
        </AppProviders>
      ),
      login: () => <Text>Pantalla de inicio de sesión</Text>,
      '(app)/_layout': () => <Stack />,
      '(app)/index': () => <Text>Pantalla de saldo</Text>,
    },
    { initialUrl: '/' },
  );
  await router;
  return router;
}

describe('arranque de la app', () => {
  test('MOB-02 con un refresh guardado renueva la sesión y muestra el saldo sin pedir credenciales', async () => {
    secureStoreMock.set(REFRESH_TOKEN_KEY, 'refresh-0');
    const fake = createFakeApi().on('POST', '/auth/refresh', json(200, tokens));

    await openApp(fake);

    expect(await screen.findByText('Pantalla de saldo')).toBeOnTheScreen();
    expect(JSON.parse(fake.requests[0]?.body ?? '')).toEqual({ refreshToken: 'refresh-0' });
    expect(secureStoreMock.entries()).toEqual({ [REFRESH_TOKEN_KEY]: 'refresh-1' });
  });

  test('MOB-02 sin refresh guardado muestra el inicio de sesión sin llamar a la API', async () => {
    const fake = createFakeApi();

    await openApp(fake);

    expect(await screen.findByText('Pantalla de inicio de sesión')).toBeOnTheScreen();
    expect(screen.queryByText('Pantalla de saldo')).toBeNull();
    expect(fake.requests).toHaveLength(0);
  });

  test('MOB-03 con el refresh revocado lo borra y muestra el inicio de sesión', async () => {
    secureStoreMock.set(REFRESH_TOKEN_KEY, 'refresh-0');
    const fake = createFakeApi().on('POST', '/auth/refresh', problem(401, 'SESSION_REVOKED'));

    await openApp(fake);

    expect(await screen.findByText('Pantalla de inicio de sesión')).toBeOnTheScreen();
    expect(secureStoreMock.entries()).toEqual({});
  });

  test('MOB-02 sin red al arrancar conserva el refresh y permite reintentar', async () => {
    secureStoreMock.set(REFRESH_TOKEN_KEY, 'refresh-0');
    const fake = createFakeApi().on('POST', '/auth/refresh', 'network-error', json(200, tokens));

    await openApp(fake);

    expect(await screen.findByText('No pudimos conectar con TreoWallet')).toBeOnTheScreen();
    expect(secureStoreMock.entries()).toEqual({ [REFRESH_TOKEN_KEY]: 'refresh-0' });
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    await waitFor(() => expect(screen.getByText('Pantalla de saldo')).toBeOnTheScreen());
  });
});
