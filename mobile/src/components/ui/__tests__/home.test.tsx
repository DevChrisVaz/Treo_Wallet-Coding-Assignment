import type { Movement } from '@devchrisvaz/wallet-contract';
import { render, screen } from '@testing-library/react-native';

import { theme } from '@/theme';

import { BalanceHero, MovementList } from '..';

const movement = (id: string, occurredAt: string): Movement => ({
  id,
  type: 'TRANSFER_OUT',
  amount: '-150.00',
  balanceAfter: '24850.00',
  concept: 'Despensa',
  reference: '1',
  counterparty: { name: 'Mamá', clabeLast4: '4321' },
  transferId: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a',
  occurredAt,
});

describe('BalanceHero', () => {
  test('MOB-19 anuncia el total completo y muestra el disponible de hoy', async () => {
    await render(<BalanceHero total="35000.00" available="31500.00" />);
    expect(screen.getByLabelText('Saldo total $35,000.00')).toBeOnTheScreen();
    expect(screen.getByText('Disponible hoy $31,500.00')).toBeOnTheScreen();
  });

  test('DSG-13 un saldo muy grande baja de tamaño para caber en una línea', async () => {
    await render(<BalanceHero total="1234567890.00" available="0.00" />);
    expect(screen.getByTestId('hero-amount', { includeHiddenElements: true })).toHaveStyle({
      fontSize: theme.typography.h1.fontSize,
    });
  });
});

describe('MovementList', () => {
  test('MOB-20 agrupa por día de Ciudad de México: las 05:30 UTC son "Ayer"', async () => {
    await render(
      <MovementList
        now={new Date('2026-10-13T18:00:00Z')}
        movements={[
          movement('a', '2026-10-13T16:42:00Z'),
          movement('b', '2026-10-13T05:30:00Z'),
          movement('c', '2026-10-09T18:20:00Z'),
        ]}
      />,
    );
    expect(screen.getAllByRole('header').map((node) => node.props.children)).toEqual([
      'Hoy',
      'Ayer',
      '9 oct',
    ]);
  });
});
