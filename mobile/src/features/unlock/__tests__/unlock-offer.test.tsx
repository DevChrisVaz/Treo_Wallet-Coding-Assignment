import * as LocalAuthentication from 'expo-local-authentication';
import { act, screen, userEvent, waitFor } from '@testing-library/react-native';

import { REFRESH_TOKEN_KEY } from '@/session/session';
import { UNLOCK_PREFERENCE_KEY } from '@/session/unlock-preference';
import { createFakeApi, json, noContent } from '@/test-utils/fake-api';
import { overview } from '@/test-utils/fixtures';
import { localAuthMock, secureStoreMock } from '@/test-utils/native-mocks';
import { TEST_TOKENS } from '@/test-utils/render-app';
import { renderRoot } from '@/test-utils/render-root';

const authSession = {
  user: { id: 'u1', email: 'ana@example.com', fullName: 'Ana Gómez' },
  tokens: TEST_TOKENS,
};

function walletApi() {
  return createFakeApi()
    .on('POST', '/auth/login', json(200, authSession))
    .on('POST', '/auth/refresh', json(200, TEST_TOKENS))
    .on('POST', '/auth/logout', noContent())
    .on('GET', '/accounts', json(200, overview()));
}

/** Inicia sesión con contraseña desde la pantalla real y espera los saldos. */
async function logInWithPassword() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Correo'), 'ana@example.com');
  await user.type(screen.getByLabelText('Contraseña'), 'secreto-123');
  await user.press(screen.getByRole('button', { name: 'Iniciar sesión' }));
  expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();
  return user;
}

const offer = () => screen.queryByRole('header', { name: 'Entrar con tu huella' });

/** Deja terminar las lecturas pendientes (`renderRouter` activa los temporizadores simulados). */
const settle = () => act(() => jest.advanceTimersByTimeAsync(500));

describe('oferta del desbloqueo biométrico', () => {
  test('MOB-24 después de iniciar sesión con contraseña ofrece "Entrar con tu huella" con "Activar" y "Ahora no"', async () => {
    await renderRoot({ fake: walletApi() });

    await logInWithPassword();

    expect(await screen.findByRole('header', { name: 'Entrar con tu huella' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Activar' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Ahora no' })).toBeOnTheScreen();
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
  });

  test('MOB-24 nombra el tipo de biometría disponible', async () => {
    localAuthMock.configure({ types: [LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION] });
    await renderRoot({ fake: walletApi() });

    await logInWithPassword();

    expect(await screen.findByRole('header', { name: 'Entrar con tu rostro' })).toBeOnTheScreen();
  });

  test('MOB-24 "Activar" con éxito biométrico activa el desbloqueo y retira la oferta', async () => {
    const { services } = await renderRoot({ fake: walletApi() });
    const user = await logInWithPassword();

    await user.press(await screen.findByRole('button', { name: 'Activar' }));

    await waitFor(() => expect(offer()).toBeNull());
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        promptMessage: 'Activa el desbloqueo de TreoWallet',
        disableDeviceFallback: false,
      }),
    );
    expect(secureStoreMock.entries()[UNLOCK_PREFERENCE_KEY]).toBe('enabled');
    expect(services.unlockPreference.getSnapshot()).toBe('enabled');
  });

  test('MOB-24 "Activar" con el diálogo cancelado deja el desbloqueo inactivo', async () => {
    localAuthMock.onAuthenticate({ success: false, error: 'user_cancel' });
    const { services } = await renderRoot({ fake: walletApi() });
    const user = await logInWithPassword();

    await user.press(await screen.findByRole('button', { name: 'Activar' }));

    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('button', { name: 'Activar' })).toBeEnabled();
    expect(offer()).toBeOnTheScreen();
    expect(secureStoreMock.entries()[UNLOCK_PREFERENCE_KEY]).toBeUndefined();
    expect(services.unlockPreference.getSnapshot()).toBeNull();
  });

  test('MOB-24 "Ahora no" se guarda y al cerrar y abrir la app con la sesión guardada no se vuelve a ofrecer', async () => {
    await renderRoot({ fake: walletApi() });
    const user = await logInWithPassword();

    await user.press(await screen.findByRole('button', { name: 'Ahora no' }));

    await waitFor(() => expect(offer()).toBeNull());
    expect(secureStoreMock.entries()).toEqual({
      [REFRESH_TOKEN_KEY]: TEST_TOKENS.refreshToken,
      [UNLOCK_PREFERENCE_KEY]: 'declined',
    });
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();

    await screen.unmount();
    await renderRoot({ fake: walletApi() });

    expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();
    await settle();
    expect(offer()).toBeNull();
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
  });

  test('MOB-24 sin biometría registrada no ofrece el desbloqueo', async () => {
    localAuthMock.configure({ enrolled: false });
    await renderRoot({ fake: walletApi() });

    await logInWithPassword();
    await settle();

    expect(offer()).toBeNull();
  });

  test('MOB-27 con el desbloqueo activo, cerrar sesión y volver a entrar con contraseña lo ofrece de nuevo', async () => {
    secureStoreMock.set(REFRESH_TOKEN_KEY, 'refresh-0');
    secureStoreMock.set(UNLOCK_PREFERENCE_KEY, 'enabled');
    await renderRoot({ fake: walletApi() });
    expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();
    expect(offer()).toBeNull();

    await userEvent.press(screen.getByRole('button', { name: 'Cerrar sesión' }));
    await logInWithPassword();

    expect(await screen.findByRole('header', { name: 'Entrar con tu huella' })).toBeOnTheScreen();
    expect(secureStoreMock.entries()[UNLOCK_PREFERENCE_KEY]).toBeUndefined();
  });
});
