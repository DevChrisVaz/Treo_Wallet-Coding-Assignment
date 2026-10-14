import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BottomSheet, BrandScreen, OptionRow, Stepper } from '..';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

describe('BottomSheet', () => {
  test('DSG-17 el botón atrás de Android la cierra', async () => {
    const onClose = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <BottomSheet open onClose={onClose} title="Cuenta de origen">
          <Text>Principal</Text>
        </BottomSheet>
      </SafeAreaProvider>,
    );
    fireEvent(screen.getByTestId('bottom-sheet-modal'), 'requestClose');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('DSG-17 tiene botón Cerrar con nombre accesible', async () => {
    const onClose = jest.fn();
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <BottomSheet open onClose={onClose} title="Cuenta de origen">
          <Text>Principal</Text>
        </BottomSheet>
      </SafeAreaProvider>,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('DSG-17 una lista larga hace scroll dentro de una hoja de como máximo 85 %', async () => {
    const options = Array.from({ length: 30 }, (_, index) => ({
      value: `a${index}`,
      label: `Cuenta ${index + 1}`,
    }));
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <BottomSheet open onClose={() => {}} title="Cuenta de origen">
          {options.map((option) => (
            <OptionRow key={option.value} option={option} onPress={() => {}} />
          ))}
        </BottomSheet>
      </SafeAreaProvider>,
    );
    expect(screen.getByTestId('bottom-sheet')).toHaveStyle({ maxHeight: '85%' });
    expect(
      within(screen.getByTestId('bottom-sheet-body')).getByRole('button', { name: 'Cuenta 30' }),
    ).toBeOnTheScreen();
  });
});

describe('Stepper', () => {
  test('MOB-21 anuncia el paso actual', async () => {
    await render(<Stepper current={4} total={5} label="Código" />);
    expect(screen.getByLabelText('Paso 4 de 5: Código')).toBeOnTheScreen();
    expect(screen.getByText('Paso 4 de 5 · Código')).toBeOnTheScreen();
  });
});

describe('BrandScreen', () => {
  test('MOB-22 muestra el Wordmark sobre la superficie de marca y el título en la hoja', async () => {
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <BrandScreen title="Inicia sesión">
          <Text>Formulario</Text>
        </BrandScreen>
      </SafeAreaProvider>,
    );
    expect(screen.getByLabelText('TreoWallet')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Inicia sesión' })).toBeOnTheScreen();
  });
});
