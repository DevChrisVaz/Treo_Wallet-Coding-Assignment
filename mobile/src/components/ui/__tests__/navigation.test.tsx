import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { theme } from '@/theme';

import { AppHeader, TabBar } from '..';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 34 },
};
const USER = { name: 'Ana Gómez Castillo', email: 'ana@example.com' };

describe('TabBar', () => {
  test('MOB-18 muestra Inicio, Movimientos y Transferir y marca la actual', async () => {
    const onSelect = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <TabBar items={['home', 'movements', 'transfer']} current="movements" onSelect={onSelect} />
      </SafeAreaProvider>,
    );
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Inicio',
      'Movimientos',
      'Transferir',
    ]);
    expect(screen.getByRole('tab', { name: 'Movimientos' })).toBeSelected();
    await fireEvent.press(screen.getByRole('tab', { name: 'Transferir' }));
    expect(onSelect).toHaveBeenCalledWith('transfer');
  });

  test('MOB-18 suma el área segura inferior a su alto', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <TabBar items={['home']} current="home" onSelect={() => {}} />
      </SafeAreaProvider>,
    );
    expect(screen.getByTestId('tab-bar')).toHaveStyle({ height: 64 + 34 });
  });

  test('MOB-18 la pestaña actual lleva la etiqueta en verde de acción y las demás en gris', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <TabBar items={['home', 'movements', 'transfer']} current="movements" onSelect={() => {}} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Movimientos')).toHaveStyle({ color: theme.colors.action.primary });
    expect(screen.getByText('Inicio')).toHaveStyle({ color: theme.colors.text.muted });
  });
});

describe('AppHeader', () => {
  test('MOB-18 el avatar abre el menú con Cerrar sesión', async () => {
    const onLogout = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <AppHeader user={USER} onLogout={onLogout} />
      </SafeAreaProvider>,
    );
    expect(screen.getByText('Ana')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Menú de la cuenta' }));
    const sheet = screen.getByTestId('bottom-sheet');
    expect(within(sheet).getByTestId('account-identity')).toHaveTextContent(/ana@example\.com/);
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Cerrar sesión' }));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });

  test('MOB-18 MOB-24 el menú de la cuenta muestra lo que se le pase junto a "Cerrar sesión"', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <AppHeader user={USER} onLogout={() => {}} menuExtra={<Text>Ajuste extra</Text>} />
      </SafeAreaProvider>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Menú de la cuenta' }));
    const sheet = screen.getByTestId('bottom-sheet');
    expect(within(sheet).getByText('Ajuste extra')).toBeOnTheScreen();
    expect(within(sheet).getByRole('button', { name: 'Cerrar sesión' })).toBeOnTheScreen();
  });

  test('MOB-18 en Inicio el saludo es el encabezado de la pantalla', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <AppHeader user={USER} />
      </SafeAreaProvider>,
    );
    expect(screen.getByRole('header', { name: 'Hola, Ana' })).toBeOnTheScreen();
  });

  test('MOB-18 MOB-19 sin el nombre (GET /me falló) saluda con "Hola" y el menú no muestra datos vacíos', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <AppHeader user={{ name: '', email: '' }} onLogout={() => {}} />
      </SafeAreaProvider>,
    );
    expect(screen.getByRole('header', { name: 'Hola' })).toBeOnTheScreen();
    expect(screen.queryByText('Hola,')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Menú de la cuenta' }));
    const sheet = screen.getByTestId('bottom-sheet');
    expect(within(sheet).queryByTestId('account-identity')).toBeNull();
    expect(within(sheet).getByRole('button', { name: 'Cerrar sesión' })).toBeOnTheScreen();
  });

  test('MOB-18 el botón del menú de la cuenta mide al menos 44 px (touchTarget)', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <AppHeader user={USER} />
      </SafeAreaProvider>,
    );
    expect(screen.getByRole('button', { name: 'Menú de la cuenta' })).toHaveStyle({
      width: theme.touchTarget,
      height: theme.touchTarget,
    });
  });
});
