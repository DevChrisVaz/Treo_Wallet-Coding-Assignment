import { render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { theme } from '@/theme';

import { Screen } from '../screen';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

test('MOB-18 con barra de pestañas, el contenido no reserva su alto: la barra va debajo, no encima', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Screen tabBar>
        <Text>Último movimiento</Text>
      </Screen>
    </SafeAreaProvider>,
  );
  const content = StyleSheet.flatten(
    screen.getByTestId('screen-scroll').props.contentContainerStyle,
  );
  expect(content.paddingBottom).not.toBe(theme.layout.tabBarHeight + theme.spacing[6]);
  expect(content).toMatchObject({ padding: theme.spacing[5] });
  expect(content.paddingBottom).toBeUndefined();
});

test('MOB-18 con barra de pestañas la pantalla no agrega el área segura de abajo: la pone la barra', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Screen tabBar>
        <Text>Contenido</Text>
      </Screen>
    </SafeAreaProvider>,
  );
  const edges = screen.getByTestId('screen-safe-area').props.edges as Record<string, string>;
  expect(Object.keys(edges).filter((edge) => edges[edge] !== 'off')).toEqual(['top']);
});

test('MOB-18 sin barra de pestañas conserva las áreas seguras de arriba y de abajo', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Screen>
        <Text>Contenido</Text>
      </Screen>
    </SafeAreaProvider>,
  );
  const edges = screen.getByTestId('screen-safe-area').props.edges as Record<string, string>;
  expect(Object.keys(edges).filter((edge) => edges[edge] !== 'off')).toEqual(['top', 'bottom']);
});
