import type { Movement } from '@devchrisvaz/wallet-contract';
import { act, screen, userEvent, within } from '@testing-library/react-native';

import { createFakeApi, json, problem } from '@/test-utils/fake-api';
import { ahorro, me, overview, principal } from '@/test-utils/fixtures';
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
  fake.on('GET', '/me', json(200, me)).on('GET', '/accounts', json(200, overview()));
  return renderApp({
    fake,
    routes: { movements: MovementsScreen },
    initialUrl: '/movements',
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

describe('selector de cuenta y día', () => {
  test('MOB-20 el selector marca la cuenta actual y al cambiar a Ahorro muestra sus últimos 20', async () => {
    const fake = createFakeApi()
      .on('GET', MOVEMENTS_PATH, json(200, page([movement(1)])))
      .on(
        'GET',
        `/accounts/${ahorro.id}/movements`,
        json(200, page([movement(2, { concept: 'Apartado' })])),
      );
    await openMovements(fake);
    expect(await screen.findByRole('button', { name: 'Principal' })).toBeSelected();
    await userEvent.press(screen.getByRole('button', { name: 'Ahorro' }));
    expect(screen.getByRole('button', { name: 'Ahorro' })).toBeSelected();
    expect(await screen.findByText('Luis · Apartado')).toBeOnTheScreen();
    expect(fake.requestsTo('GET', `/accounts/${ahorro.id}/movements`)[0]?.path).toBe(
      `/accounts/${ahorro.id}/movements?limit=20`,
    );
  });

  describe('agrupación por día de Ciudad de México', () => {
    // Solo `Date` es falso: TanStack Query y la API simulada siguen con temporizadores reales.
    const REAL = [
      'nextTick',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'hrtime',
      'performance',
    ] as const;
    afterEach(() => jest.useRealTimers());

    async function dayHeaders(now: string, times: [string, string]) {
      jest.useFakeTimers({ now: new Date(now), doNotFake: [...REAL] });
      const items = times.map((occurredAt, index) => movement(index + 1, { occurredAt }));
      await openMovements(createFakeApi().on('GET', MOVEMENTS_PATH, json(200, page(items))));
      await screen.findAllByTestId('movement-row');
      return screen.getAllByRole('header').map((node) => node.props.children);
    }

    test('MOB-20 un movimiento de las 05:30 UTC de hoy aparece bajo "Ayer"', async () => {
      expect(
        await dayHeaders('2026-10-13T18:00:00Z', ['2026-10-13T16:42:00Z', '2026-10-13T05:30:00Z']),
      ).toEqual(['Movimientos', 'Hoy', 'Ayer']);
    });

    test('MOB-20 el 1 de enero, un movimiento de las 23:30 del 31 de diciembre aparece bajo "Ayer"', async () => {
      expect(
        await dayHeaders('2026-01-01T18:00:00Z', ['2026-01-01T16:00:00Z', '2026-01-01T05:30:00Z']),
      ).toEqual(['Movimientos', 'Hoy', 'Ayer']);
    });
  });

  test('MOB-20 si la lectura falla, el error dice qué lectura falló y permite reintentar', async () => {
    const fake = createFakeApi().on('GET', MOVEMENTS_PATH, 'network-error');
    await openMovements(fake);
    expect(await screen.findByText('No pudimos cargar los movimientos')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeOnTheScreen();
  });

  test('MOB-20 si GET /accounts falla, muestra el error de cuentas con reintento', async () => {
    const fake = createFakeApi()
      .on('GET', '/me', json(200, me))
      .on('GET', '/accounts', problem(500, 'INTERNAL_ERROR'), json(200, overview()))
      .on('GET', MOVEMENTS_PATH, json(200, page([movement(1)])));
    await renderApp({ fake, routes: { movements: MovementsScreen }, initialUrl: '/movements' });
    expect(await screen.findByText('No pudimos cargar tus cuentas')).toBeOnTheScreen();
    expect(fake.requestsTo('GET', MOVEMENTS_PATH)).toHaveLength(0);
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Luis · Movimiento 1')).toBeOnTheScreen();
  });

  test('MOB-20 deslizar para actualizar sin cuenta resuelta no pide /accounts//movements', async () => {
    const fake = createFakeApi()
      .on('GET', '/me', json(200, me))
      .on('GET', '/accounts', problem(500, 'INTERNAL_ERROR'));
    await renderApp({ fake, routes: { movements: MovementsScreen }, initialUrl: '/movements' });
    await screen.findByText('No pudimos cargar tus cuentas');
    await act(async () => {
      await screen.getByTestId('screen-scroll').props.refreshControl.props.onRefresh();
    });
    expect(fake.requests.filter((request) => request.path.includes('/accounts//'))).toHaveLength(0);
    expect(fake.requests.filter((request) => request.path.includes('/movements'))).toHaveLength(0);
  });
});
