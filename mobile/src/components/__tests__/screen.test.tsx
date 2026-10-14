import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { theme } from '@/theme';

import { Screen } from '../screen';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

test('MOB-18 con barra de pestañas, el contenido reserva su alto para no quedar tapado', async () => {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Screen tabBar>
        <Text>Último movimiento</Text>
      </Screen>
    </SafeAreaProvider>,
  );
  expect(screen.getByTestId('screen-scroll')).toHaveProp(
    'contentContainerStyle',
    expect.arrayContaining([
      expect.objectContaining({ paddingBottom: theme.layout.tabBarHeight + theme.spacing[6] }),
    ]),
  );
});
