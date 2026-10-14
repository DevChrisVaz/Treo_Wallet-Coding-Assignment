import { screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import TabsLayout from '@/app/(app)/(tabs)/_layout';
import AppLayout from '@/app/(app)/_layout';
import { createFakeApi } from '@/test-utils/fake-api';
import { renderApp } from '@/test-utils/render-app';

// El árbol real: la pila de `(app)` con las pestañas y, encima, el flujo de transferencia.
const routes = {
  '(app)/_layout': AppLayout,
  '(app)/(tabs)/_layout': TabsLayout,
  '(app)/(tabs)/index': () => <Text>Pantalla de inicio</Text>,
  '(app)/(tabs)/movements': () => <Text>Pantalla de movimientos</Text>,
  '(app)/transfer/index': () => <Text>Elegir destinatario</Text>,
};

describe('pestañas de la app', () => {
  test('MOB-18 la barra muestra Inicio, Movimientos y Transferir y marca la pestaña actual', async () => {
    await renderApp({ fake: createFakeApi(), routes });
    expect(await screen.findByText('Pantalla de inicio')).toBeOnTheScreen();
    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Inicio',
      'Movimientos',
      'Transferir',
    ]);
    expect(screen.getByRole('tab', { name: 'Inicio' })).toBeSelected();
  });

  test('MOB-18 tocar Movimientos abre la pestaña y la marca como seleccionada para los lectores de pantalla', async () => {
    const { router } = await renderApp({ fake: createFakeApi(), routes });
    await userEvent.press(await screen.findByRole('tab', { name: 'Movimientos' }));
    expect(await screen.findByText('Pantalla de movimientos')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'Movimientos' })).toBeSelected();
    expect(router.getPathname()).toBe('/movements');
  });

  test('MOB-18 tocar Transferir abre el flujo como pantalla de la pila, fuera de las pestañas', async () => {
    const { router } = await renderApp({ fake: createFakeApi(), routes });
    await userEvent.press(await screen.findByRole('tab', { name: 'Transferir' }));
    expect(await screen.findByText('Elegir destinatario')).toBeOnTheScreen();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(router.getPathname()).toBe('/transfer');
    expect(router.getSegments()).toEqual(['(app)', 'transfer']);
  });
});
