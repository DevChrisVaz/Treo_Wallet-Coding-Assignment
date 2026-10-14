import * as LocalAuthentication from 'expo-local-authentication';
import { act, fireEvent, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { HomeScreen } from '@/features/accounts/home-screen';
import { REFRESH_TOKEN_KEY } from '@/session/session';
import { UNLOCK_PREFERENCE_KEY } from '@/session/unlock-preference';
import { mockAppState } from '@/test-utils/app-state';
import { createFakeApi, json, noContent } from '@/test-utils/fake-api';
import { overview } from '@/test-utils/fixtures';
import { localAuthMock, secureStoreMock } from '@/test-utils/native-mocks';
import { renderApp, TEST_TOKENS } from '@/test-utils/render-app';
import { renderRoot } from '@/test-utils/render-root';

const EXPLANATION = 'Registra una huella en los ajustes de tu teléfono para usar esta opción.';

const unlockSwitch = (name = 'Desbloqueo con huella') => screen.findByRole('switch', { name });

/** Pantalla de inicio con la sesión iniciada (sin pasar por el arranque). */
async function openHome() {
  const fake = createFakeApi()
    .on('GET', '/accounts', json(200, overview()))
    .on('POST', '/auth/logout', noContent());
  const rendered = await renderApp({
    fake,
    routes: { index: HomeScreen, 'accounts/[accountId]': () => <Text>Movimientos</Text> },
  });
  expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Menú de la cuenta' }));
  return { ...rendered, fake };
}

const toggle = (value: boolean) =>
  act(async () => {
    fireEvent(screen.getByRole('switch'), 'valueChange', value);
  });

/** Deja terminar las lecturas pendientes (`renderRouter` activa los temporizadores simulados). */
const settle = () => act(() => jest.advanceTimersByTimeAsync(500));

describe('interruptor del desbloqueo biométrico', () => {
  test('MOB-24 el interruptor "Desbloqueo con huella" es accesible y empieza apagado', async () => {
    await openHome();

    const control = await unlockSwitch();
    expect(control).not.toBeChecked();
    expect(control).toBeEnabled();
    expect(screen.getByText('Desbloqueo con huella')).toBeOnTheScreen();
    expect(screen.queryByText(EXPLANATION)).toBeNull();
  });

  test('MOB-24 nombra el tipo de biometría del dispositivo', async () => {
    localAuthMock.configure({ types: [LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION] });
    await openHome();
    expect(await unlockSwitch('Desbloqueo con rostro')).toBeOnTheScreen();
  });

  test('MOB-24 encenderlo pide la biometría y con éxito activa el desbloqueo', async () => {
    const { services } = await openHome();
    await unlockSwitch();

    await toggle(true);

    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
    expect(await unlockSwitch()).toBeChecked();
    expect(secureStoreMock.entries()[UNLOCK_PREFERENCE_KEY]).toBe('enabled');
    expect(services.unlockPreference.getSnapshot()).toBe('enabled');
  });

  test('MOB-24 si se cancela el diálogo, el interruptor sigue apagado', async () => {
    localAuthMock.onAuthenticate({ success: false, error: 'user_cancel' });
    await openHome();
    await unlockSwitch();

    await toggle(true);

    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
    expect(await unlockSwitch()).not.toBeChecked();
    expect(secureStoreMock.entries()[UNLOCK_PREFERENCE_KEY]).toBeUndefined();
  });

  test('MOB-27 apagarlo borra la preferencia sin pedir biometría ni cerrar la sesión', async () => {
    secureStoreMock.set(UNLOCK_PREFERENCE_KEY, 'enabled');
    const { services, fake } = await openHome();
    expect(await unlockSwitch()).toBeChecked();

    await toggle(false);

    expect(await unlockSwitch()).not.toBeChecked();
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
    expect(secureStoreMock.entries()).toEqual({ [REFRESH_TOKEN_KEY]: TEST_TOKENS.refreshToken });
    expect(services.session.getSnapshot()).toEqual({ status: 'signedIn' });
    expect(fake.requestsTo('POST', '/auth/logout')).toHaveLength(0);
  });

  test('MOB-24 sin biometría registrada aparece deshabilitado con una explicación', async () => {
    localAuthMock.configure({ enrolled: false });
    await openHome();

    const control = await unlockSwitch();
    expect(control).toBeDisabled();
    expect(control).not.toBeChecked();
    expect(control.props.accessibilityHint).toBe(EXPLANATION);
    expect(screen.getByText(EXPLANATION)).toBeOnTheScreen();
  });

  test('MOB-24 al volver de los ajustes con una huella registrada, el interruptor se habilita', async () => {
    localAuthMock.configure({ enrolled: false });
    const appState = mockAppState('active');
    await openHome();
    expect(await unlockSwitch()).toBeDisabled();

    await act(async () => appState.emit('background'));
    localAuthMock.configure({ enrolled: true });
    await act(async () => appState.emit('active'));

    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());
    expect(screen.queryByText(EXPLANATION)).toBeNull();
  });
});

describe('interruptor en el flujo completo', () => {
  function walletApi() {
    return createFakeApi()
      .on('POST', '/auth/login', json(200, { user: { id: 'u1' }, tokens: TEST_TOKENS }))
      .on('POST', '/auth/refresh', json(200, TEST_TOKENS))
      .on('GET', '/accounts', json(200, overview()));
  }

  async function logInWithPassword() {
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Correo'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secreto-123');
    await user.press(screen.getByRole('button', { name: 'Iniciar sesión' }));
    expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();
    return user;
  }

  test('MOB-24 activar desde la oferta deja el interruptor encendido', async () => {
    await renderRoot({ fake: walletApi() });
    const user = await logInWithPassword();

    await user.press(await screen.findByRole('button', { name: 'Activar' }));
    await user.press(screen.getByRole('button', { name: 'Menú de la cuenta' }));

    await waitFor(() => expect(screen.getByRole('switch')).toBeChecked());
    expect(screen.getByRole('switch', { name: 'Desbloqueo con huella' })).toBeOnTheScreen();
  });

  test('MOB-24 apagar el interruptor después de activarlo no vuelve a mostrar la oferta', async () => {
    await renderRoot({ fake: walletApi() });
    const user = await logInWithPassword();
    await user.press(await screen.findByRole('button', { name: 'Activar' }));
    await user.press(screen.getByRole('button', { name: 'Menú de la cuenta' }));
    await waitFor(() => expect(screen.getByRole('switch')).toBeChecked());

    await toggle(false);
    await settle();

    expect(screen.getByRole('switch')).not.toBeChecked();
    expect(screen.queryByRole('header', { name: 'Entrar con tu huella' })).toBeNull();
  });

  test('MOB-27 al apagar el interruptor y reabrir la app, restaura la sesión sin pedir biometría', async () => {
    secureStoreMock.set(REFRESH_TOKEN_KEY, 'refresh-0');
    secureStoreMock.set(UNLOCK_PREFERENCE_KEY, 'enabled');
    await renderRoot({ fake: walletApi() });
    expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Menú de la cuenta' }));
    expect(await unlockSwitch()).toBeChecked();

    await toggle(false);
    await waitFor(() => expect(secureStoreMock.entries()[UNLOCK_PREFERENCE_KEY]).toBeUndefined());
    await screen.unmount();
    await renderRoot({ fake: walletApi() });

    expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('TreoWallet está bloqueada')).toBeNull();
  });
});
