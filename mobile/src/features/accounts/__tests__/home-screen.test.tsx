import type { AccountsOverview, Movement } from '@devchrisvaz/wallet-contract';
import { act, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { Text } from 'react-native';

import TabsLayout from '@/app/(app)/(tabs)/_layout';
import { createFakeApi, json, problem } from '@/test-utils/fake-api';
import { ahorro, me, overview, principal } from '@/test-utils/fixtures';
import { renderApp } from '@/test-utils/render-app';
import { theme } from '@/theme';

import { HomeScreen } from '../home-screen';
import { MovementsScreen } from '../movements-screen';

const routes = {
  index: HomeScreen,
  movements: () => <Text>Movimientos de la cuenta</Text>,
  'transfer/index': () => <Text>Elegir beneficiario</Text>,
};

function row(id: string, concept: string): Movement {
  return {
    id,
    type: 'TRANSFER_OUT',
    amount: '-100.00',
    balanceAfter: '24900.00',
    concept,
    reference: '1',
    counterparty: { name: 'Luis', clabeLast4: '5678' },
    transferId: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a',
    occurredAt: '2026-10-13T16:42:00Z',
  };
}

/** Lecturas de Inicio: usuario, cuentas y los últimos movimientos de cada cuenta. */
function homeApi(accounts: AccountsOverview = overview()) {
  return createFakeApi()
    .on('GET', '/me', json(200, me))
    .on('GET', '/accounts', json(200, accounts))
    .on(
      'GET',
      `/accounts/${principal.id}/movements`,
      json(200, { items: [row('p1', 'Renta de octubre')], nextCursor: null }),
    )
    .on(
      'GET',
      `/accounts/${ahorro.id}/movements`,
      json(200, { items: [row('a1', 'Apartado quincenal')], nextCursor: null }),
    );
}

const tabRoutes = {
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': HomeScreen,
  '(tabs)/movements': MovementsScreen,
  'transfer/index': () => <Text>Elegir beneficiario</Text>,
};

async function pullToRefresh() {
  const scroll = screen.getByTestId('screen-scroll');
  await act(async () => {
    await scroll.props.refreshControl.props.onRefresh();
  });
}

describe('pantalla de saldo', () => {
  test('MOB-05 muestra cada cuenta con nombre, CLABE enmascarada y saldo en es-MX, y lo que queda del límite', async () => {
    const fake = homeApi();
    await renderApp({ fake, routes });

    expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();
    expect(screen.getByText('$10,000.00')).toBeOnTheScreen();
    expect(screen.getByText('Principal')).toBeOnTheScreen();
    expect(screen.getByText('CLABE •••• 9719')).toBeOnTheScreen();
    expect(screen.getByText('CLABE •••• 1234')).toBeOnTheScreen();
    expect(screen.getByText('Te quedan $31,500.00 hoy')).toBeOnTheScreen();
    expect(screen.getByText('$25,000.00')).toHaveStyle({ fontVariant: ['tabular-nums'] });
    expect(fake.requests[0]?.headers.authorization).toBe('Bearer access-1');
  });

  test('MOB-15 un saldo grande se muestra a partir del string, sin floats', async () => {
    const big = { ...principal, balance: '1234567.89' };
    await renderApp({ fake: homeApi(overview([big, ahorro])), routes });
    expect(await screen.findByText('$1,234,567.89')).toBeOnTheScreen();
    expect(screen.getByLabelText('Saldo total $1,244,567.89')).toBeOnTheScreen();
  });

  test('MOB-05 mientras carga muestra esqueletos', async () => {
    jest.useFakeTimers();
    const fake = homeApi().on('GET', '/accounts', 'hang');
    await renderApp({ fake, routes });
    expect(
      screen.getAllByTestId('skeleton', { includeHiddenElements: true }).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Principal')).toBeNull();
    jest.useRealTimers();
  });

  test('MOB-05 si la consulta falla muestra el error con Reintentar y después los saldos', async () => {
    const fake = homeApi().on(
      'GET',
      '/accounts',
      problem(500, 'INTERNAL_ERROR'),
      json(200, overview()),
    );
    await renderApp({ fake, routes });

    expect(await screen.findByRole('alert')).toHaveTextContent(/Algo falló de nuestro lado/);
    expect(screen.queryByText(/\$/)).toBeNull();
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();
  });

  test('MOB-05 al deslizar hacia abajo vuelve a consultar y actualiza los saldos', async () => {
    const updated = overview(
      [{ ...principal, balance: '23500.00' }, ahorro],
      '20000.00',
      '30000.00',
    );
    const fake = homeApi().on('GET', '/accounts', json(200, overview()), json(200, updated));
    await renderApp({ fake, routes });
    expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();

    await pullToRefresh();

    expect(await screen.findByText('$23,500.00')).toBeOnTheScreen();
    expect(screen.getByText('Te quedan $30,000.00 hoy')).toBeOnTheScreen();
    expect(fake.requestsTo('GET', '/accounts')).toHaveLength(2);
  });

  test('MOB-05 si la actualización falla no muestra los saldos anteriores como actuales', async () => {
    const fake = homeApi().on('GET', '/accounts', json(200, overview()), 'network-error');
    await renderApp({ fake, routes });
    expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();

    await pullToRefresh();

    await waitFor(() => expect(screen.queryByText('$25,000.00')).toBeNull());
    expect(screen.getByRole('alert')).toHaveTextContent(/No pudimos conectar/);
    expect(screen.getByRole('alert')).toHaveStyle({
      backgroundColor: theme.colors.status.danger.bg,
    });
  });

  test('MOB-05 sin cuentas muestra un estado vacío', async () => {
    await renderApp({ fake: homeApi(overview([])), routes });
    expect(await screen.findByText('Aún no tienes cuentas')).toBeOnTheScreen();
  });

  test('MOB-05 MOB-19 sin cuentas, deslizar vuelve a consultar las cuentas sin pedir movimientos', async () => {
    const fake = homeApi(overview([]));
    await renderApp({ fake, routes });
    expect(await screen.findByText('Aún no tienes cuentas')).toBeOnTheScreen();

    await pullToRefresh();

    expect(fake.requestsTo('GET', '/accounts')).toHaveLength(2);
    const paths = fake.requests.map((request) => request.path);
    expect(paths.filter((path) => path.includes('/movements'))).toEqual([]);
  });

  test('MOB-06 MOB-20 MOB-19 Movimientos muestra la cuenta elegida en Inicio', async () => {
    const fake = homeApi().on(
      'GET',
      '/accounts/[^/]+/movements',
      json(200, { items: [], nextCursor: null }),
    );
    await renderApp({ fake, routes: { ...routes, movements: MovementsScreen } });
    await userEvent.press(await screen.findByRole('button', { name: /^Ahorro/ }));
    await userEvent.press(screen.getByRole('button', { name: 'Ver todos los movimientos' }));
    expect(await screen.findByText('Aún no hay movimientos')).toBeOnTheScreen();
    // Inicio pide los últimos 5 de cada cuenta que muestra; Movimientos, los últimos 20 de la elegida.
    const recent = (accountId: string) =>
      fake
        .requestsTo('GET', `/accounts/${accountId}/movements`)
        .filter((request) => request.path.endsWith('?limit=20'));
    expect(recent(ahorro.id)).toHaveLength(1);
    expect(recent(principal.id)).toHaveLength(0);
  });

  test('MOB-04 cerrar sesión borra la sesión y los datos en memoria', async () => {
    const fake = homeApi().on('POST', '/auth/logout', new Response(null, { status: 204 }));
    const { services } = await renderApp({ fake, routes });
    await screen.findByText('$25,000.00');

    await userEvent.press(screen.getByRole('button', { name: 'Menú de la cuenta' }));
    await userEvent.press(
      within(screen.getByTestId('bottom-sheet')).getByRole('button', { name: 'Cerrar sesión' }),
    );

    await waitFor(() =>
      expect(services.session.getSnapshot()).toEqual({ status: 'signedOut', reason: 'logout' }),
    );
    expect(services.queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  test('MOB-18 MOB-24 el menú de la cuenta muestra el interruptor del desbloqueo junto a "Cerrar sesión"', async () => {
    await renderApp({ fake: homeApi(), routes });
    await screen.findByText('$25,000.00');
    expect(screen.queryByRole('switch', { name: 'Desbloqueo con huella' })).toBeNull();
    await userEvent.press(screen.getByRole('button', { name: 'Menú de la cuenta' }));
    const sheet = screen.getByTestId('bottom-sheet');
    expect(
      await within(sheet).findByRole('switch', { name: 'Desbloqueo con huella' }),
    ).toBeOnTheScreen();
    expect(within(sheet).getByRole('button', { name: 'Cerrar sesión' })).toBeOnTheScreen();
  });

  test('MOB-19 saluda con el nombre del usuario', async () => {
    await renderApp({ fake: homeApi(), routes });
    expect(await screen.findByLabelText('Hola, Ana')).toBeOnTheScreen();
  });

  test('MOB-19 MOB-18 si GET /me falla saluda sin nombre, y Reintentar o deslizar lo vuelven a pedir', async () => {
    const fake = homeApi()
      .on('GET', '/me', 'network-error', 'network-error', json(200, me))
      .on('GET', '/accounts', 'network-error', json(200, overview()));
    await renderApp({ fake, routes });

    expect(await screen.findByText('No pudimos cargar tus cuentas')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Hola' })).toBeOnTheScreen();
    await userEvent.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();
    await waitFor(() => expect(fake.requestsTo('GET', '/me')).toHaveLength(2));
    expect(screen.getByRole('header', { name: 'Hola' })).toBeOnTheScreen();

    await pullToRefresh();

    expect(await screen.findByLabelText('Hola, Ana')).toBeOnTheScreen();
    expect(fake.requestsTo('GET', '/me')).toHaveLength(3);
  });

  test('MOB-19 el hero muestra $35,000.00 sumado sin punto flotante y lo disponible hoy', async () => {
    await renderApp({ fake: homeApi(), routes });
    expect(await screen.findByLabelText('Saldo total $35,000.00')).toBeOnTheScreen();
    expect(screen.getByText('Disponible hoy $31,500.00')).toBeOnTheScreen();
  });

  test('MOB-19 la primera cuenta queda seleccionada y la lista trae sus últimos 5 movimientos', async () => {
    const fake = homeApi();
    await renderApp({ fake, routes });
    expect(await screen.findByRole('button', { name: /^Principal/ })).toBeSelected();
    expect(await screen.findByText(/Renta de octubre/)).toBeOnTheScreen();
    expect(fake.requestsTo('GET', `/accounts/${principal.id}/movements`)[0]?.path).toBe(
      `/accounts/${principal.id}/movements?limit=5`,
    );
  });

  test('MOB-19 al tocar Ahorro la tarjeta queda marcada y la lista muestra los de Ahorro', async () => {
    await renderApp({ fake: homeApi(), routes });
    await userEvent.press(await screen.findByRole('button', { name: /^Ahorro/ }));
    expect(screen.getByRole('button', { name: /^Ahorro/ })).toBeSelected();
    expect(screen.getByRole('button', { name: /^Principal/ })).not.toBeSelected();
    expect(await screen.findByText(/Apartado quincenal/)).toBeOnTheScreen();
  });

  test('MOB-19 "Ver todos" con Ahorro seleccionada abre Movimientos con Ahorro', async () => {
    const fake = homeApi();
    const { router } = await renderApp({ fake, routes: tabRoutes });
    await userEvent.press(await screen.findByRole('button', { name: /^Ahorro/ }));
    await userEvent.press(screen.getByRole('button', { name: 'Ver todos los movimientos' }));
    await waitFor(() => expect(router.getPathname()).toBe('/movements'));
    await waitFor(() =>
      expect(
        fake.requestsTo('GET', `/accounts/${ahorro.id}/movements`).map((r) => r.path),
      ).toContain(`/accounts/${ahorro.id}/movements?limit=20`),
    );
  });

  test('MOB-19 "Transferir" del hero abre el flujo', async () => {
    const { router } = await renderApp({ fake: homeApi(), routes });
    await userEvent.press(await screen.findByRole('button', { name: 'Transferir' }));
    expect(await screen.findByText('Elegir beneficiario')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/transfer');
  });

  test('MOB-19 si la consulta falla, el error dice qué lectura falló', async () => {
    const fake = homeApi().on('GET', '/accounts', 'network-error');
    await renderApp({ fake, routes });
    expect(await screen.findByText('No pudimos cargar tus cuentas')).toBeOnTheScreen();
  });
});
