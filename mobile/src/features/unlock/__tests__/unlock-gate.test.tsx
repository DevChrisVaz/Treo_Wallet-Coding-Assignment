import type { LocalAuthenticationResult } from 'expo-local-authentication';
import * as LocalAuthentication from 'expo-local-authentication';
import { act, screen } from '@testing-library/react-native';

import { REFRESH_TOKEN_KEY } from '@/session/session';
import { UNLOCK_PREFERENCE_KEY } from '@/session/unlock-preference';
import { createFakeApi, json } from '@/test-utils/fake-api';
import { overview } from '@/test-utils/fixtures';
import { localAuthMock, secureStoreMock } from '@/test-utils/native-mocks';
import { TEST_TOKENS } from '@/test-utils/render-app';
import { renderRoot } from '@/test-utils/render-root';

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
