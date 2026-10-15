import { iconConcepts, iconNames } from '@devchrisvaz/wallet-design-tokens';
import { isHiddenFromAccessibility, render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import * as Lucide from 'lucide-react-native';

import { theme } from '@/theme';

import { Avatar, EXTRA_ICONS, ICONS, Icon, IconButton, initials } from '..';

describe('Icon', () => {
  test.each(iconConcepts)('DSG-15 %s usa el icono del mapa compartido', (concept) => {
    expect(ICONS[concept]).toBe((Lucide as unknown as Record<string, unknown>)[iconNames[concept]]);
  });

  test.each([
    ['search', 'Search'],
    ['receive', 'ArrowDownToLine'],
    ['copy', 'Copy'],
    ['share', 'Share2'],
    ['eye', 'Eye'],
    ['eyeOff', 'EyeOff'],
  ] as const)('DSG-15 el glifo propio %s usa %s de Lucide', (name, lucideName) => {
    expect(EXTRA_ICONS[name]).toBe((Lucide as unknown as Record<string, unknown>)[lucideName]);
  });

  test('DSG-15 un icono propio con etiqueta se anuncia como imagen', async () => {
    await render(<Icon name="receive" label="Recibir" color={theme.colors.text.primary} />);
    expect(screen.getByLabelText('Recibir')).toBeOnTheScreen();
  });

  test('DSG-15 un icono con etiqueta se anuncia como imagen', async () => {
    await render(<Icon name="error" label="Error" color={theme.colors.status.danger.fg} />);
    expect(screen.getByLabelText('Error')).toBeOnTheScreen();
  });

  test('DSG-15 un icono sin etiqueta es decorativo: queda oculto para los lectores de pantalla', async () => {
    await render(
      <View testID="probe">
        <Icon name="info" color={theme.colors.text.primary} />
      </View>,
    );
    const [wrapper] = screen.getByTestId('probe').children;
    expect(wrapper).toBeDefined();
    expect(isHiddenFromAccessibility(wrapper as never)).toBe(true);
  });

  test('DSG-15 un botón solo con icono tiene nombre accesible', async () => {
    await render(<IconButton icon="close" label="Cerrar" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeOnTheScreen();
  });
});

describe('Avatar', () => {
  test.each([
    ['Ana Gómez Castillo', 'AG'],
    ['Ángel', 'Á'],
    ['  luis   pérez ', 'LP'],
  ])('DSG-17 las iniciales de "%s" son %s', (name, expected) => {
    expect(initials(name)).toBe(expected);
  });

  test('DSG-17 el avatar es decorativo', async () => {
    await render(<Avatar initials="AG" />);
    expect(screen.queryByText('AG')).toBeNull(); // oculto a la accesibilidad por defecto
    expect(screen.getByText('AG', { includeHiddenElements: true })).toBeTruthy();
  });
});
