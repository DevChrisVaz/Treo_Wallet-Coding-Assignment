import { act, render, screen, userEvent } from '@testing-library/react-native';
import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { AppProviders, createServices } from '@/app-services';
import { RootNavigator } from '@/navigation/root-navigator';
import { REFRESH_TOKEN_KEY } from '@/session/session';
import { createFakeApi, json, problem, type FakeApi } from '@/test-utils/fake-api';
import { secureStoreMock } from '@/test-utils/native-mocks';

import { LoginScreen } from '../login-screen';

const BASE_URL = 'http://192.168.1.50:4000';

const authSession = {
  user: { id: 'u1', email: 'ana@example.com', fullName: 'Ana Gómez' },
  tokens: {
    tokenType: 'Bearer',
    accessToken: 'access-1',
    accessTokenExpiresAt: '2026-10-13T17:00:00Z',
    refreshToken: 'refresh-1',
    refreshTokenExpiresAt: '2026-11-13T17:00:00Z',
  },
};

async function renderLogin(fake: FakeApi) {
  const services = createServices(BASE_URL, fake.fetch);
  await render(
    <AppProviders baseUrl={BASE_URL} services={services}>
      <LoginScreen />
    </AppProviders>,
  );
  return services;
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, password = 'secreto-123') {
  await user.type(screen.getByLabelText('Correo'), 'ana@example.com');
  await user.type(screen.getByLabelText('Contraseña'), password);
  await user.press(screen.getByRole('button', { name: 'Iniciar sesión' }));
}

describe('inicio de sesión', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('MOB-01 con credenciales válidas guarda la sesión y muestra la pantalla de saldo', async () => {
    const fake = createFakeApi().on('POST', '/auth/login', json(200, authSession));
    const router = renderRouter(
      {
        _layout: () => (
          <AppProviders baseUrl={BASE_URL} fetch={fake.fetch}>
            <RootNavigator />
          </AppProviders>
        ),
        login: () => <LoginScreen />,
        '(app)/_layout': () => <Stack />,
        '(app)/index': () => <Text>Pantalla de saldo</Text>,
      },
      { initialUrl: '/' },
    );
    await router;
    const user = userEvent.setup();

    await fillAndSubmit(user);

    expect(await screen.findByText('Pantalla de saldo')).toBeOnTheScreen();
    expect(JSON.parse(fake.requests[0]?.body ?? '')).toEqual({
      email: 'ana@example.com',
      password: 'secreto-123',
    });
    expect(secureStoreMock.entries()).toEqual({ [REFRESH_TOKEN_KEY]: 'refresh-1' });
  });

  test('MOB-01 mientras envía, el botón queda deshabilitado y anuncia que está en curso', async () => {
    jest.useFakeTimers();
    const fake = createFakeApi().on('POST', '/auth/login', 'hang');
    await renderLogin(fake);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await fillAndSubmit(user);

    const button = screen.getByRole('button', { name: 'Iniciar sesión' });
    expect(button).toBeDisabled();
    expect(button).toBeBusy();
    await user.press(button);
    expect(fake.requests).toHaveLength(1);
  });

  test('MOB-01 con credenciales inválidas muestra el mensaje genérico y borra la contraseña', async () => {
    const fake = createFakeApi().on('POST', '/auth/login', problem(401, 'INVALID_CREDENTIALS'));
    const services = await renderLogin(fake);
    const user = userEvent.setup();

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El correo o la contraseña no coinciden.',
    );
    expect(screen.getByLabelText('Contraseña')).toHaveDisplayValue('');
    expect(screen.getByLabelText('Correo')).toHaveDisplayValue('ana@example.com');
    expect(services.session.getSnapshot().status).not.toBe('signedIn');
  });

  test('MOB-01 con el correo sin verificar indica completar la verificación en la web y no guarda tokens', async () => {
    const fake = createFakeApi().on('POST', '/auth/login', problem(403, 'EMAIL_NOT_VERIFIED'));
    await renderLogin(fake);
    const user = userEvent.setup();

    await fillAndSubmit(user);

    expect(
      await screen.findByText(
        'Confirma tu correo con el código que te enviamos. La verificación se completa en la web de TreoWallet.',
      ),
    ).toBeOnTheScreen();
    expect(secureStoreMock.entries()).toEqual({});
  });

  test('MOB-01 con 429 deshabilita el botón durante Retry-After y muestra cuánto falta', async () => {
    jest.useFakeTimers();
    const fake = createFakeApi().on(
      'POST',
      '/auth/login',
      problem(429, 'RATE_LIMITED', {}, { 'Retry-After': '30' }),
    );
    await renderLogin(fake);
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    await fillAndSubmit(user);

    expect(await screen.findByText('Podrás intentar de nuevo en 30 s.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeDisabled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10_000);
    });
    expect(screen.getByText('Podrás intentar de nuevo en 20 s.')).toBeOnTheScreen();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20_000);
    });
    expect(screen.queryByText(/Podrás intentar de nuevo/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled();
  });

  test('MOB-01 valida el correo con el esquema del contrato antes de enviar', async () => {
    const fake = createFakeApi();
    await renderLogin(fake);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Correo'), 'ana@');
    await user.type(screen.getByLabelText('Contraseña'), 'x');
    await user.press(screen.getByRole('button', { name: 'Iniciar sesión' }));

    expect(screen.getByText('El correo no tiene un formato válido')).toBeOnTheScreen();
    expect(fake.requests).toHaveLength(0);
  });

  test('MOB-01 no ofrece registro ni verificación de correo en la app', async () => {
    await renderLogin(createFakeApi());
    expect(screen.getAllByRole('button').map((button) => button.props.accessibilityLabel)).toEqual([
      'Mostrar contraseña',
      'Iniciar sesión',
    ]);
  });

  test('MOB-03 después de una sesión revocada avisa que hay que iniciar sesión de nuevo', async () => {
    const fake = createFakeApi();
    const services = createServices(BASE_URL, fake.fetch);
    await services.session.clear('revoked');
    await render(
      <AppProviders baseUrl={BASE_URL} services={services}>
        <LoginScreen />
      </AppProviders>,
    );
    expect(
      screen.getByText('Cerramos tu sesión por seguridad. Inicia sesión de nuevo.'),
    ).toBeOnTheScreen();
  });

  test('MOB-22 se ve la superficie de marca con el Wordmark y el formulario en una hoja blanca con los campos de MOB-01', async () => {
    await renderLogin(createFakeApi());
    expect(screen.getByText('Tu billetera digital en pesos mexicanos.')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Inicia sesión' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Correo')).toBeOnTheScreen();
    expect(screen.getByLabelText('Contraseña')).toBeOnTheScreen();
    expect(
      screen.getByText(
        /El registro y la verificación del correo se hacen en la web de TreoWallet\./,
      ),
    ).toBeOnTheScreen();
  });
});
