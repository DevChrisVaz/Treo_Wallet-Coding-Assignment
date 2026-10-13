import type { Movement } from '@devchrisvaz/wallet-contract';
import { screen, userEvent, within } from '@testing-library/react-native';

import { createFakeApi, json, problem } from '@/test-utils/fake-api';
import { overview, principal } from '@/test-utils/fixtures';
import { renderApp } from '@/test-utils/render-app';
import { theme } from '@/theme';

import { MovementsScreen } from '../movements-screen';

const MOVEMENTS_PATH = `/accounts/${principal.id}/movements`;

function movement(index: number, overrides: Partial<Movement> = {}): Movement {
  return {
    id: `m${index}`,
    type: 'TRANSFER_OUT',
    amount: '-100.00',
    balanceAfter: '24900.00',
    concept: `Movimiento ${index}`,
    reference: String(index),
    counterparty: { name: 'Luis', clabeLast4: '5678' },
    transferId: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a',
    occurredAt: `2026-10-${String(30 - index).padStart(2, '0')}T16:00:00Z`,
    ...overrides,
  };
}

const page = (items: Movement[]) => ({ items, nextCursor: items.length ? 'cursor-2' : null });

async function openMovements(fake: ReturnType<typeof createFakeApi>) {
  fake.on('GET', '/accounts', json(200, overview()));
  return renderApp({
    fake,
    routes: { 'accounts/[accountId]': MovementsScreen },
    initialUrl: `/accounts/${principal.id}`,
  });
}

describe('últimos 20 movimientos', () => {
  test('MOB-06 pide los últimos 20 de la cuenta elegida y los muestra del más reciente al más antiguo', async () => {
    const items = Array.from({ length: 20 }, (_, index) => movement(index + 1));
    const fake = createFakeApi().on('GET', MOVEMENTS_PATH, json(200, page(items)));
    await openMovements(fake);

    const rows = await screen.findAllByTestId('movement-row');
    expect(rows).toHaveLength(20);
    expect(within(rows[0]!).getByText('Luis · Movimiento 1')).toBeOnTheScreen();
    expect(within(rows[19]!).getByText('Luis · Movimiento 20')).toBeOnTheScreen();
    const [request] = fake.requestsTo('GET', MOVEMENTS_PATH);
    expect(request?.path).toBe(`${MOVEMENTS_PATH}?limit=20`);
    expect(await screen.findByText('Principal')).toBeOnTheScreen();
  });

  test('MOB-06 una salida se ve como −$150.00 en tinta y una entrada como +$25,000.00 en verde', async () => {
    const items = [
      movement(1, { type: 'TRANSFER_OUT', amount: '-150.00', balanceAfter: '24850.00' }),
      movement(2, {
        type: 'DEPOSIT',
        amount: '25000.00',
        balanceAfter: '25000.00',
        concept: 'Depósito inicial',
        counterparty: null,
      }),
    ];
    const fake = createFakeApi().on('GET', MOVEMENTS_PATH, json(200, page(items)));
    await openMovements(fake);

    expect(await screen.findByText('Transferencia enviada')).toBeOnTheScreen();
    expect(screen.getByText('−$150.00')).toHaveStyle({ color: theme.colors.money.out });
    expect(screen.getByText('Saldo $24,850.00')).toBeOnTheScreen();
    expect(screen.getByText('Depósito')).toBeOnTheScreen();
    expect(screen.getByText('+$25,000.00')).toHaveStyle({ color: theme.colors.money.in });
  });

  test('MOB-15 los montos con centavos exactos se muestran sin errores de precisión', async () => {
    const items = [movement(1, { type: 'TRANSFER_IN', amount: '0.10', balanceAfter: '0.30' })];
    const fake = createFakeApi().on('GET', MOVEMENTS_PATH, json(200, page(items)));
    await openMovements(fake);
    expect(await screen.findByText('+$0.10')).toBeOnTheScreen();
    expect(screen.getByText('Saldo $0.30')).toBeOnTheScreen();
  });

  test('MOB-06 una cuenta sin movimientos muestra un estado vacío', async () => {
    const fake = createFakeApi().on('GET', MOVEMENTS_PATH, json(200, page([])));
    await openMovements(fake);
    expect(await screen.findByText('Aún no hay movimientos')).toBeOnTheScreen();
  });

  test('MOB-06 si la consulta falla muestra el error y permite reintentar', async () => {
    const fake = createFakeApi().on(
      'GET',
      MOVEMENTS_PATH,
      problem(500, 'INTERNAL_ERROR'),
      json(200, page([movement(1)])),
    );
    await openMovements(fake);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Folio para soporte: req-test-1/);
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Luis · Movimiento 1')).toBeOnTheScreen();
  });

  test('MOB-06 mientras carga muestra esqueletos', async () => {
    jest.useFakeTimers();
    const fake = createFakeApi().on('GET', MOVEMENTS_PATH, 'hang');
    await openMovements(fake);
    expect(
      screen.getAllByTestId('skeleton', { includeHiddenElements: true }).length,
    ).toBeGreaterThan(0);
    jest.useRealTimers();
  });
});
