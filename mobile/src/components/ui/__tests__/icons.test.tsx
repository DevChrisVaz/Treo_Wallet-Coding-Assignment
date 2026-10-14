import { iconConcepts, iconNames } from '@devchrisvaz/wallet-design-tokens';
import { render, screen } from '@testing-library/react-native';
import * as Lucide from 'lucide-react-native';

import { theme } from '@/theme';

import { Avatar, ICONS, Icon, IconButton, initials } from '..';

describe('Icon', () => {
  test.each(iconConcepts)('DSG-15 %s usa el icono del mapa compartido', (concept) => {
    expect(ICONS[concept]).toBe((Lucide as unknown as Record<string, unknown>)[iconNames[concept]]);
  });

  test('DSG-15 un icono con etiqueta se anuncia como imagen', async () => {
    await render(<Icon name="error" label="Error" color={theme.colors.status.danger.fg} />);
    expect(screen.getByLabelText('Error')).toBeOnTheScreen();
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
