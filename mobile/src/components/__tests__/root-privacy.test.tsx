import { act, render, screen } from '@testing-library/react-native';

import RootLayout from '@/app/_layout';
import { mockAppState } from '@/test-utils/app-state';

jest.mock('expo-font', () => ({ useFonts: () => [true, null] }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => true),
  hideAsync: jest.fn(async () => undefined),
}));

describe('pantalla de privacidad en la raíz', () => {
  test('MOB-16 el layout raíz cubre cualquier pantalla al pasar a segundo plano', async () => {
    const appState = mockAppState('active');
    // Sin EXPO_PUBLIC_API_URL en las pruebas, la raíz muestra la pantalla de configuración.
    await render(<RootLayout />);
    expect(screen.getByText('Falta configurar la API')).toBeOnTheScreen();

    await act(async () => appState.emit('inactive'));

    expect(screen.getByTestId('privacy-overlay')).toBeOnTheScreen();
    expect(screen.queryByText('Falta configurar la API')).toBeNull();
  });
});
