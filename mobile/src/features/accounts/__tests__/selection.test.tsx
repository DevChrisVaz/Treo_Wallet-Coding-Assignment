import { act, render, screen, userEvent } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { AppProviders, createServices } from '@/app-services';
import { logout } from '@/session/logout';
import { Session } from '@/session/session';
import { createFakeApi, noContent } from '@/test-utils/fake-api';
import { ahorro, principal } from '@/test-utils/fixtures';
import { TEST_BASE_URL, TEST_TOKENS } from '@/test-utils/render-app';

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
      <AccountSelectionProvider session={new Session()}>
        <Chooser label="Inicio" />
        <Chooser label="Movimientos" />
      </AccountSelectionProvider>,
    );
    await userEvent.press(screen.getByRole('button', { name: 'Inicio' }));
    expect(screen.getByText(`Movimientos: ${ahorro.id}`)).toBeOnTheScreen();
  });

  test('MOB-04 MOB-19 cerrar sesión olvida la cuenta elegida: al volver a entrar no queda la anterior', async () => {
    const fake = createFakeApi().on('POST', '/auth/logout', noContent());
    const services = createServices(TEST_BASE_URL, fake.fetch, { testing: true });
    await services.session.start(TEST_TOKENS);
    await render(
      <AppProviders baseUrl={TEST_BASE_URL} services={services}>
        <Chooser label="Movimientos" />
      </AppProviders>,
    );
    await userEvent.press(screen.getByRole('button', { name: 'Movimientos' }));
    expect(screen.getByText(`Movimientos: ${ahorro.id}`)).toBeOnTheScreen();

    await act(() => logout(services.session, services.api));
    await act(() => services.session.start(TEST_TOKENS));

    expect(services.session.getSnapshot()).toEqual({ status: 'signedIn' });
    expect(screen.getByText('Movimientos: ninguna')).toBeOnTheScreen();
  });

  test('MOB-19 si la cuenta elegida ya no existe se usa la primera', () => {
    expect(selectedAccount([principal, ahorro], ahorro.id)).toBe(ahorro);
    expect(selectedAccount([principal, ahorro], 'otra')).toBe(principal);
    expect(selectedAccount([principal, ahorro], null)).toBe(principal);
    expect(selectedAccount([], null)).toBeUndefined();
  });
});
