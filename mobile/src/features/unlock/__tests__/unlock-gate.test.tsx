import type { LocalAuthenticationResult } from 'expo-local-authentication';
import * as LocalAuthentication from 'expo-local-authentication';
import { act, screen, userEvent } from '@testing-library/react-native';

import { REFRESH_TOKEN_KEY } from '@/session/session';
import { UNLOCK_PREFERENCE_KEY } from '@/session/unlock-preference';
import { mockAppState } from '@/test-utils/app-state';
import { createFakeApi, json, noContent, problem, type FakeReply } from '@/test-utils/fake-api';
import { overview } from '@/test-utils/fixtures';
import { localAuthMock, secureStoreMock } from '@/test-utils/native-mocks';
import { TEST_TOKENS } from '@/test-utils/render-app';
import { createClock, renderRoot } from '@/test-utils/render-root';

function savedSession({ unlock }: { unlock?: 'enabled' | 'declined' } = {}) {
  secureStoreMock.set(REFRESH_TOKEN_KEY, 'refresh-0');
  if (unlock) secureStoreMock.set(UNLOCK_PREFERENCE_KEY, unlock);
}

function walletApi() {
  return createFakeApi()
    .on('POST', '/auth/refresh', json(200, TEST_TOKENS))
    .on('GET', '/accounts', json(200, overview()));
}

/**
 * Deja correr las tareas pendientes, para que una renovación indebida alcance a registrarse
 * (`renderRouter` activa los temporizadores simulados de Jest).
 */
const settle = () => act(() => jest.advanceTimersByTimeAsync(500));

/** Diálogo biométrico que queda abierto hasta que la prueba lo resuelve. */
function pendingDialog() {
  let finish: (result: LocalAuthenticationResult) => void = () => {};
  localAuthMock.onAuthenticate(() => new Promise((resolve) => (finish = resolve)));
  return {
    finish: (result: LocalAuthenticationResult) => act(async () => finish(result)),
  };
}

describe('puerta de desbloqueo al abrir la app', () => {
  test('MOB-25 con el desbloqueo activo pide la huella antes de cualquier renovación', async () => {
    savedSession({ unlock: 'enabled' });
    const dialog = pendingDialog();
    const fake = walletApi();

    await renderRoot({ fake });

    expect(await screen.findByText('TreoWallet está bloqueada')).toBeOnTheScreen();
    await settle();
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
    expect(fake.requests).toHaveLength(0);
    expect(screen.queryByText('$25,000.00')).toBeNull();

    await dialog.finish({ success: true });

    expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();
    expect(screen.queryByText('TreoWallet está bloqueada')).toBeNull();
    const [refresh] = fake.requestsTo('POST', '/auth/refresh');
    expect(JSON.parse(refresh?.body ?? '')).toEqual({ refreshToken: 'refresh-0' });
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
  });

  test('MOB-25 con el desbloqueo inactivo restaura la sesión sin pedir biometría, como en MOB-02', async () => {
    savedSession();
    const fake = walletApi();

    await renderRoot({ fake });

    expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
    expect(fake.requestsTo('POST', '/auth/refresh')).toHaveLength(1);
  });

  test('MOB-25 con "Ahora no" guardado restaura la sesión sin pedir biometría', async () => {
    savedSession({ unlock: 'declined' });
    const fake = walletApi();

    await renderRoot({ fake });

    expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
  });

  test('MOB-25 sin refresh guardado muestra el inicio de sesión sin pedir biometría', async () => {
    secureStoreMock.set(UNLOCK_PREFERENCE_KEY, 'enabled');
    const fake = walletApi();

    await renderRoot({ fake });

    expect(await screen.findByRole('header', { name: 'Inicia sesión' })).toBeOnTheScreen();
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
    expect(fake.requests).toHaveLength(0);
  });
});

describe('alternativas al desbloqueo', () => {
  const loginHeader = () => screen.findByRole('header', { name: 'Inicia sesión' });

  test.each([
    ['con red', noContent()],
    ['sin red', 'network-error'],
  ] as [string, FakeReply][])(
    'MOB-26 "Usar mi contraseña" %s revoca el refresh, borra los tokens y la preferencia y muestra el inicio de sesión',
    async (_, logoutReply) => {
      savedSession({ unlock: 'enabled' });
      localAuthMock.onAuthenticate({ success: false, error: 'user_cancel' });
      const fake = walletApi().on('POST', '/auth/logout', logoutReply);
      const { services } = await renderRoot({ fake });
      await screen.findByText('TreoWallet está bloqueada');

      await userEvent.press(screen.getByRole('button', { name: 'Usar mi contraseña' }));

      expect(await loginHeader()).toBeOnTheScreen();
      expect(screen.queryByText('TreoWallet está bloqueada')).toBeNull();
      const [revoke] = fake.requestsTo('POST', '/auth/logout');
      expect(JSON.parse(revoke?.body ?? '')).toEqual({ refreshToken: 'refresh-0' });
      expect(fake.requestsTo('POST', '/auth/refresh')).toHaveLength(0);
      expect(secureStoreMock.entries()).toEqual({});
      expect(services.unlockPreference.getSnapshot()).toBeNull();
    },
  );

  test('MOB-26 con las huellas retiradas del dispositivo desactiva el desbloqueo, cierra la sesión y muestra el inicio de sesión', async () => {
    savedSession({ unlock: 'enabled' });
    localAuthMock.configure({ enrolled: false });
    const fake = walletApi().on('POST', '/auth/logout', noContent());

    await renderRoot({ fake });

    expect(await loginHeader()).toBeOnTheScreen();
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
    expect(fake.requestsTo('POST', '/auth/logout')).toHaveLength(1);
    expect(fake.requestsTo('POST', '/auth/refresh')).toHaveLength(0);
    expect(secureStoreMock.entries()).toEqual({});
  });

  test('MOB-26 "Usar mi contraseña" al volver de segundo plano también lleva al inicio de sesión', async () => {
    savedSession({ unlock: 'enabled' });
    const appState = mockAppState('active');
    const clock = createClock();
    const fake = walletApi().on('POST', '/auth/logout', noContent());
    await renderRoot({ fake, clock });
    expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();
    localAuthMock.onAuthenticate({ success: false, error: 'user_cancel' });

    await act(async () => appState.emit('background'));
    clock.advance(90_000);
    await act(async () => appState.emit('active'));
    await userEvent.press(screen.getByRole('button', { name: 'Usar mi contraseña' }));

    expect(await loginHeader()).toBeOnTheScreen();
    expect(screen.queryByText('TreoWallet está bloqueada')).toBeNull();
    expect(screen.queryByText('$25,000.00')).toBeNull();
    expect(secureStoreMock.entries()).toEqual({});
  });

  test('MOB-27 si la renovación responde SESSION_REVOKED con el desbloqueo activo, borra tokens y preferencia y muestra el inicio de sesión', async () => {
    savedSession({ unlock: 'enabled' });
    const fake = createFakeApi().on('POST', '/auth/refresh', problem(401, 'SESSION_REVOKED'));

    const { services } = await renderRoot({ fake });

    expect(await loginHeader()).toBeOnTheScreen();
    expect(
      screen.getByText('Cerramos tu sesión por seguridad. Inicia sesión de nuevo.'),
    ).toBeOnTheScreen();
    expect(secureStoreMock.entries()).toEqual({});
    expect(services.unlockPreference.getSnapshot()).toBeNull();
  });
});
