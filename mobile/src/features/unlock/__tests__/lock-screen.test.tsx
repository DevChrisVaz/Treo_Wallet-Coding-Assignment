import type {
  LocalAuthenticationError,
  LocalAuthenticationResult,
} from 'expo-local-authentication';
import * as LocalAuthentication from 'expo-local-authentication';
import { act, render, screen, userEvent } from '@testing-library/react-native';

import { localAuthMock } from '@/test-utils/native-mocks';

import { LockScreen } from '../lock-screen';

const LOCKOUT = 'Demasiados intentos. Intenta más tarde o usa tu contraseña.';

async function renderLockScreen() {
  const onUnlock = jest.fn();
  const onSignOut = jest.fn();
  await render(<LockScreen onUnlock={onUnlock} onSignOut={onSignOut} />);
  // El diálogo automático y la lectura del tipo de biometría terminan.
  await act(async () => {});
  return { onUnlock, onSignOut };
}

function expectBothOptions() {
  expect(screen.getByRole('button', { name: 'Desbloquear con huella' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Usar mi contraseña' })).toBeEnabled();
}

const failure = (error: LocalAuthenticationError) => ({ success: false as const, error });

describe('pantalla de bloqueo', () => {
  test('MOB-25 muestra la marca, el aviso y las dos opciones, sin datos de la cuenta', async () => {
    localAuthMock.onAuthenticate(failure('user_cancel'));
    await renderLockScreen();

    expect(screen.getByRole('header', { name: 'TreoWallet' })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'TreoWallet está bloqueada' })).toBeOnTheScreen();
    expectBothOptions();
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(screen.queryByText(/CLABE|@/)).toBeNull();
  });

  test('MOB-25 pide la biometría una sola vez al aparecer y con éxito desbloquea', async () => {
    const { onUnlock, onSignOut } = await renderLockScreen();
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
    expect(onUnlock).toHaveBeenCalledTimes(1);
    expect(onSignOut).not.toHaveBeenCalled();
  });

  test('MOB-25 al cancelar el diálogo se queda en la pantalla sin volver a abrirlo por su cuenta', async () => {
    localAuthMock.onAuthenticate(failure('user_cancel'), failure('system_cancel'), {
      success: true,
    });
    const { onUnlock, onSignOut } = await renderLockScreen();

    expectBothOptions();
    await act(async () => {});
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
    expect(onUnlock).not.toHaveBeenCalled();
    expect(onSignOut).not.toHaveBeenCalled();

    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Desbloquear con huella' }));
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(2);
    expect(onUnlock).not.toHaveBeenCalled();
    expectBothOptions();

    await user.press(screen.getByRole('button', { name: 'Desbloquear con huella' }));
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  test('MOB-25 mientras el diálogo está abierto, "Desbloquear" no abre otro', async () => {
    let finish: (result: LocalAuthenticationResult) => void = () => {};
    localAuthMock.onAuthenticate(() => new Promise((resolve) => (finish = resolve)));
    await renderLockScreen();

    expect(screen.getByRole('button', { name: 'Desbloquear con huella' })).toBeDisabled();
    await act(async () => finish({ success: false, error: 'user_cancel' }));
    expect(screen.getByRole('button', { name: 'Desbloquear con huella' })).toBeEnabled();
  });

  test('MOB-26 con el bloqueo temporal del sistema explica qué pasó y mantiene ambas opciones', async () => {
    localAuthMock.onAuthenticate(failure('lockout'));
    const { onUnlock, onSignOut } = await renderLockScreen();

    expect(screen.getByText(LOCKOUT)).toBeOnTheScreen();
    expectBothOptions();
    expect(onUnlock).not.toHaveBeenCalled();
    expect(onSignOut).not.toHaveBeenCalled();
  });

  test('MOB-26 sin biometría registrada ni credencial pide cerrar la sesión', async () => {
    for (const error of ['not_enrolled', 'passcode_not_set', 'not_available'] as const) {
      localAuthMock.onAuthenticate(failure(error));
      const { onUnlock, onSignOut } = await renderLockScreen();
      expect(onSignOut).toHaveBeenCalledTimes(1);
      expect(onUnlock).not.toHaveBeenCalled();
      await screen.unmount();
    }
  });

  test('MOB-26 con las huellas retiradas no abre el diálogo y pide cerrar la sesión', async () => {
    localAuthMock.configure({ enrolled: false });
    const { onSignOut } = await renderLockScreen();
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  test('MOB-25 ante un error desconocido muestra un mensaje genérico y conserva ambas opciones', async () => {
    localAuthMock.onAuthenticate(failure('unknown'), { success: true });
    const { onUnlock, onSignOut } = await renderLockScreen();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'No pudimos verificar tu identidad. Intenta de nuevo o usa tu contraseña.',
    );
    expectBothOptions();
    expect(onSignOut).not.toHaveBeenCalled();

    await userEvent.press(screen.getByRole('button', { name: 'Desbloquear con huella' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  test('MOB-26 "Usar mi contraseña" pide cerrar la sesión', async () => {
    localAuthMock.onAuthenticate(failure('user_cancel'));
    const { onSignOut, onUnlock } = await renderLockScreen();

    await userEvent.press(screen.getByRole('button', { name: 'Usar mi contraseña' }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(onUnlock).not.toHaveBeenCalled();
  });

  test('MOB-25 el botón nombra el tipo de biometría del dispositivo', async () => {
    localAuthMock.configure({ types: [LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION] });
    localAuthMock.onAuthenticate(failure('user_cancel'));
    await renderLockScreen();
    expect(screen.getByRole('button', { name: 'Desbloquear con rostro' })).toBeOnTheScreen();
  });
});
