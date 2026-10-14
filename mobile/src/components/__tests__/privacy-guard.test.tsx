import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { mockAppState } from '@/test-utils/app-state';
import { theme } from '@/theme';

import { PrivacyGuard } from '../privacy-guard';

async function renderGuarded() {
  const appState = mockAppState('active');
  const view = await render(
    <PrivacyGuard>
      <Text>Saldo $25,000.00</Text>
    </PrivacyGuard>,
  );
  return { appState, view };
}

describe('pantalla de privacidad', () => {
  test('MOB-16 con la app activa no cubre nada', async () => {
    await renderGuarded();
    expect(screen.getByText('Saldo $25,000.00')).toBeOnTheScreen();
    expect(screen.queryByTestId('privacy-overlay')).toBeNull();
  });

  test('MOB-16 al pasar a inactiva cubre todo con la superficie invertida y el logotipo', async () => {
    const { appState } = await renderGuarded();
    await act(async () => appState.emit('inactive'));

    expect(screen.getByTestId('privacy-overlay')).toHaveStyle({
      backgroundColor: theme.colors.surface.inverse,
    });
    expect(screen.getByText('Treo')).toHaveStyle({ color: theme.colors.text.onInverse });
    expect(screen.getByText('Wallet')).toHaveStyle({ color: theme.colors.text.onInverse });
    // El contenido queda oculto también para los lectores de pantalla.
    expect(screen.queryByText('Saldo $25,000.00')).toBeNull();
  });

  test('MOB-16 en segundo plano también cubre el contenido', async () => {
    const { appState } = await renderGuarded();
    await act(async () => appState.emit('background'));
    expect(screen.getByTestId('privacy-overlay')).toBeOnTheScreen();
  });

  test('MOB-16 al volver a estar activa se retira y se ve la misma pantalla', async () => {
    const { appState } = await renderGuarded();
    await act(async () => appState.emit('background'));
    await act(async () => appState.emit('active'));
    expect(screen.queryByTestId('privacy-overlay')).toBeNull();
    expect(screen.getByText('Saldo $25,000.00')).toBeOnTheScreen();
  });

  test('MOB-16 deja de escuchar AppState al desmontarse', async () => {
    const { appState, view } = await renderGuarded();
    expect(appState.listenerCount()).toBe(1);
    await view.unmount();
    expect(appState.listenerCount()).toBe(0);
  });
});
