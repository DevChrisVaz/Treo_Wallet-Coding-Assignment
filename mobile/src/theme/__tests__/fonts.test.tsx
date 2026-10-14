import { render, screen } from '@testing-library/react-native';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Text } from 'react-native';

import { theme } from '@/theme';
import { appFonts, FontsGate } from '@/theme/fonts';

jest.mock('expo-font', () => ({ useFonts: jest.fn() }));
jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => true),
  hideAsync: jest.fn(async () => undefined),
}));

const useFontsMock = jest.mocked(useFonts);

describe('tipografía Work Sans', () => {
  test('DSG-05 carga exactamente los pesos 400, 500 y 600 que usa el tema', () => {
    const families = new Set(Object.values(theme.typography).map((style) => style.fontFamily));
    expect(Object.keys(appFonts).sort()).toEqual([...families].sort());
    expect(Object.keys(appFonts).sort()).toEqual([
      'WorkSans_400Regular',
      'WorkSans_500Medium',
      'WorkSans_600SemiBold',
    ]);
  });

  test('DSG-05 los estilos de texto del tema no llevan fontWeight', () => {
    for (const style of Object.values(theme.typography)) {
      expect(style).not.toHaveProperty('fontWeight');
    }
  });

  test('DSG-05 mantiene la pantalla de carga mientras las fuentes cargan', async () => {
    useFontsMock.mockReturnValue([false, null]);
    await render(
      <FontsGate>
        <Text>Contenido</Text>
      </FontsGate>,
    );
    expect(useFontsMock).toHaveBeenCalledWith(appFonts);
    expect(screen.queryByText('Contenido')).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });

  test('DSG-05 retira la pantalla de carga y muestra la app cuando las fuentes cargan', async () => {
    useFontsMock.mockReturnValue([true, null]);
    await render(
      <FontsGate>
        <Text>Contenido</Text>
      </FontsGate>,
    );
    expect(screen.getByText('Contenido')).toBeOnTheScreen();
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  test('DSG-05 si Work Sans no carga, muestra la app con la fuente de respaldo', async () => {
    useFontsMock.mockReturnValue([false, new Error('sin red')]);
    await render(
      <FontsGate>
        <Text>Contenido</Text>
      </FontsGate>,
    );
    expect(screen.getByText('Contenido')).toBeOnTheScreen();
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });
});
