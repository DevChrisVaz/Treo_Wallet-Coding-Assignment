import { render, screen, userEvent } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { ahorro, principal } from '@/test-utils/fixtures';

import { AccountSelectionProvider, selectedAccount, useAccountSelection } from '../selection';

function Chooser({ label }: { label: string }) {
  const { accountId, select } = useAccountSelection();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => select(ahorro.id)}
    >
      <Text>{`${label}: ${accountId ?? 'ninguna'}`}</Text>
    </Pressable>
  );
}

describe('selección de cuenta', () => {
  test('MOB-19 MOB-20 Inicio y Movimientos comparten la cuenta elegida', async () => {
    await render(
      <AccountSelectionProvider>
        <Chooser label="Inicio" />
        <Chooser label="Movimientos" />
      </AccountSelectionProvider>,
    );
    await userEvent.press(screen.getByRole('button', { name: 'Inicio' }));
    expect(screen.getByText(`Movimientos: ${ahorro.id}`)).toBeOnTheScreen();
  });

  test('MOB-19 si la cuenta elegida ya no existe se usa la primera', () => {
    expect(selectedAccount([principal, ahorro], ahorro.id)).toBe(ahorro);
    expect(selectedAccount([principal, ahorro], 'otra')).toBe(principal);
    expect(selectedAccount([principal, ahorro], null)).toBe(principal);
    expect(selectedAccount([], null)).toBeUndefined();
  });
});
