import * as LocalAuthentication from 'expo-local-authentication';
import { act, screen, userEvent } from '@testing-library/react-native';
import { act as actNow } from 'react';

import { REFRESH_TOKEN_KEY } from '@/session/session';
import { UNLOCK_PREFERENCE_KEY } from '@/session/unlock-preference';
import { mockAppState } from '@/test-utils/app-state';
import { createFakeApi, json } from '@/test-utils/fake-api';
import { ahorro, overview } from '@/test-utils/fixtures';
import { localAuthMock, secureStoreMock } from '@/test-utils/native-mocks';
import { TEST_TOKENS } from '@/test-utils/render-app';
import { createClock, renderRoot } from '@/test-utils/render-root';

const SECONDS = 1000;

/** Arranca con la sesión guardada y la pantalla de saldo a la vista. */
async function openApp({ unlock }: { unlock?: 'enabled' | 'declined' } = { unlock: 'enabled' }) {
  secureStoreMock.set(REFRESH_TOKEN_KEY, 'refresh-0');
  if (unlock) secureStoreMock.set(UNLOCK_PREFERENCE_KEY, unlock);
  const appState = mockAppState('active');
  const clock = createClock();
  const fake = createFakeApi()
    .on('POST', '/auth/refresh', json(200, TEST_TOKENS))
    .on('GET', '/accounts', json(200, overview()));
  const rendered = await renderRoot({ fake, clock });
  expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();
  jest.mocked(LocalAuthentication.authenticateAsync).mockClear();
  return { ...rendered, appState, clock, fake };
}

type Opened = Awaited<ReturnType<typeof openApp>>;

/** Manda la app a segundo plano y la regresa después de `ms` según el reloj de la app. */
async function leaveAndReturn({ appState, clock }: Opened, ms: number) {
  await act(async () => appState.emit('background'));
  clock.advance(ms);
  await act(async () => appState.emit('active'));
}

describe('bloqueo al volver de segundo plano', () => {
  test('MOB-25 al volver a los 30 segundos no pide la huella y muestra la pantalla en la que estaba', async () => {
    const app = await openApp();

    await leaveAndReturn(app, 30 * SECONDS);

    expect(screen.getByText('$25,000.00')).toBeOnTheScreen();
    expect(screen.queryByText('TreoWallet está bloqueada')).toBeNull();
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
  });

  test('MOB-25 al volver a los 90 segundos muestra la pantalla de bloqueo y pide la huella antes de mostrar saldos', async () => {
    let finish: (success: boolean) => void = () => {};
    const app = await openApp();
    localAuthMock.onAuthenticate(
      () =>
        new Promise(
          (resolve) =>
            (finish = (success) =>
              resolve(success ? { success } : { success: false, error: 'user_cancel' })),
        ),
    );

    await leaveAndReturn(app, 90 * SECONDS);

    expect(screen.getByText('TreoWallet está bloqueada')).toBeOnTheScreen();
    expect(screen.queryByText('$25,000.00')).toBeNull();
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);

    await act(async () => finish(true));

    expect(screen.queryByText('TreoWallet está bloqueada')).toBeNull();
    expect(screen.getByText('$25,000.00')).toBeOnTheScreen();
    // La sesión no se restauró de nuevo: la navegación siguió montada debajo.
    expect(app.fake.requestsTo('POST', '/auth/refresh')).toHaveLength(1);
  });

  test('MOB-25 con 60 segundos exactos también bloquea', async () => {
    const app = await openApp();
    localAuthMock.onAuthenticate(() => new Promise(() => {}));

    await leaveAndReturn(app, 60 * SECONDS);

    expect(screen.getByText('TreoWallet está bloqueada')).toBeOnTheScreen();
  });

  test('MOB-25 después de desbloquear sigue en la pantalla en la que estaba', async () => {
    const app = await openApp();
    await userEvent.press(screen.getByRole('button', { name: /^Ahorro/ }));
    expect(await screen.findByText('Movimientos de la cuenta')).toBeOnTheScreen();

    await leaveAndReturn(app, 2 * 60 * SECONDS);

    expect(screen.queryByText('TreoWallet está bloqueada')).toBeNull();
    expect(screen.getByText('Movimientos de la cuenta')).toBeOnTheScreen();
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
    expect(app.router.getPathname()).toBe(`/accounts/${ahorro.id}`);
  });

  test('MOB-25 "inactive" (centro de control de iOS) no cuenta como segundo plano', async () => {
    const { appState, clock } = await openApp();

    await act(async () => appState.emit('inactive'));
    clock.advance(90 * SECONDS);
    await act(async () => appState.emit('active'));

    expect(screen.getByText('$25,000.00')).toBeOnTheScreen();
    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
  });

  test('MOB-25 con el desbloqueo inactivo no bloquea al volver', async () => {
    for (const unlock of [undefined, 'declined'] as const) {
      const app = await openApp({ unlock });
      await leaveAndReturn(app, 90 * SECONDS);
      expect(screen.getByText('$25,000.00')).toBeOnTheScreen();
      expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
      await screen.unmount();
    }
  });

  test('MOB-25 si el desbloqueo se activa con la app abierta, el siguiente regreso ya bloquea', async () => {
    const app = await openApp({ unlock: undefined });
    localAuthMock.onAuthenticate(() => new Promise(() => {}));

    await act(() => app.services.unlockPreference.save('enabled'));
    await leaveAndReturn(app, 90 * SECONDS);

    expect(screen.getByText('TreoWallet está bloqueada')).toBeOnTheScreen();
  });

  test('MOB-16 la pantalla de privacidad se mantiene hasta que la pantalla de bloqueo la sustituye', async () => {
    const { appState, clock } = await openApp();
    localAuthMock.onAuthenticate(() => new Promise(() => {}));

    await act(async () => appState.emit('background'));
    expect(screen.getByTestId('privacy-overlay')).toBeOnTheScreen();
    expect(screen.queryByText('$25,000.00')).toBeNull();
    clock.advance(90 * SECONDS);

    // Sin esperar promesas (act síncrono de React): el bloqueo entra en el mismo cambio que retira
    // la privacidad, así que ningún saldo queda a la vista entre los dos.
    actNow(() => appState.emit('active'));

    expect(screen.queryByTestId('privacy-overlay')).toBeNull();
    expect(screen.getByText('TreoWallet está bloqueada')).toBeOnTheScreen();
    expect(screen.queryByText('$25,000.00')).toBeNull();
    await act(async () => {});
  });

  test('MOB-16 al volver a los 30 segundos la privacidad se retira y queda la misma pantalla', async () => {
    const app = await openApp();

    await leaveAndReturn(app, 30 * SECONDS);

    expect(screen.queryByTestId('privacy-overlay')).toBeNull();
    expect(screen.getByText('$25,000.00')).toBeOnTheScreen();
  });
});
