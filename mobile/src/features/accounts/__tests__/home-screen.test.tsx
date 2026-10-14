import { act, screen, userEvent, waitFor, within } from '@testing-library/react-native';
import { Text } from 'react-native';

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

async function pullToRefresh() {
  const scroll = screen.getByTestId('screen-scroll');
  await act(async () => {
    await scroll.props.refreshControl.props.onRefresh();
  });
}

describe('pantalla de saldo', () => {
  test('MOB-05 muestra cada cuenta con nombre, CLABE enmascarada y saldo en es-MX, y lo que queda del límite', async () => {
    const fake = createFakeApi()
      .on('GET', '/me', json(200, me))
      .on('GET', '/accounts', json(200, overview()));
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
    const fake = createFakeApi()
      .on('GET', '/me', json(200, me))
      .on('GET', '/accounts', json(200, overview([big])));
    await renderApp({ fake, routes });
    expect(await screen.findByText('$1,234,567.89')).toBeOnTheScreen();
  });

  test('MOB-05 mientras carga muestra esqueletos', async () => {
    jest.useFakeTimers();
    const fake = createFakeApi().on('GET', '/me', json(200, me)).on('GET', '/accounts', 'hang');
    await renderApp({ fake, routes });
    expect(
      screen.getAllByTestId('skeleton', { includeHiddenElements: true }).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Principal')).toBeNull();
    jest.useRealTimers();
  });

  test('MOB-05 si la consulta falla muestra el error con Reintentar y después los saldos', async () => {
    const fake = createFakeApi()
      .on('GET', '/me', json(200, me))
      .on('GET', '/accounts', problem(500, 'INTERNAL_ERROR'), json(200, overview()));
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
    const fake = createFakeApi()
      .on('GET', '/me', json(200, me))
      .on('GET', '/accounts', json(200, overview()), json(200, updated));
    await renderApp({ fake, routes });
    expect(await screen.findByText('$25,000.00')).toBeOnTheScreen();

    await pullToRefresh();

    expect(await screen.findByText('$23,500.00')).toBeOnTheScreen();
    expect(screen.getByText('Te quedan $30,000.00 hoy')).toBeOnTheScreen();
    expect(fake.requestsTo('GET', '/accounts')).toHaveLength(2);
  });

  test('MOB-05 si la actualización falla no muestra los saldos anteriores como actuales', async () => {
    const fake = createFakeApi()
      .on('GET', '/me', json(200, me))
      .on('GET', '/accounts', json(200, overview()), 'network-error');
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
    const fake = createFakeApi()
      .on('GET', '/me', json(200, me))
      .on('GET', '/accounts', json(200, overview([])));
    await renderApp({ fake, routes });
    expect(await screen.findByText('Aún no tienes cuentas')).toBeOnTheScreen();
  });

  test('MOB-06 tocar una cuenta abre sus movimientos', async () => {
    const fake = createFakeApi()
      .on('GET', '/me', json(200, me))
      .on('GET', '/accounts', json(200, overview()));
    const { router } = await renderApp({ fake, routes });
    await userEvent.press(await screen.findByRole('button', { name: /^Ahorro/ }));
    expect(await screen.findByText('Movimientos de la cuenta')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/movements');
  });

  test('MOB-06 MOB-20 Movimientos muestra la cuenta que se tocó en Inicio', async () => {
    const fake = createFakeApi()
      .on('GET', '/me', json(200, me))
      .on('GET', '/accounts', json(200, overview()))
      .on('GET', '/accounts/[^/]+/movements', json(200, { items: [], nextCursor: null }));
    await renderApp({ fake, routes: { ...routes, movements: MovementsScreen } });
    await userEvent.press(await screen.findByRole('button', { name: /^Ahorro/ }));
    expect(await screen.findByText('Aún no hay movimientos')).toBeOnTheScreen();
    expect(fake.requestsTo('GET', `/accounts/${ahorro.id}/movements`)).toHaveLength(1);
    expect(fake.requestsTo('GET', `/accounts/${principal.id}/movements`)).toHaveLength(0);
  });

  test('MOB-04 cerrar sesión borra la sesión y los datos en memoria', async () => {
    const fake = createFakeApi()
      .on('GET', '/me', json(200, me))
      .on('GET', '/accounts', json(200, overview()))
      .on('POST', '/auth/logout', new Response(null, { status: 204 }));
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
    const fake = createFakeApi()
      .on('GET', '/me', json(200, me))
      .on('GET', '/accounts', json(200, overview()));
    await renderApp({ fake, routes });
    await screen.findByText('$25,000.00');
    expect(screen.queryByRole('switch', { name: 'Desbloqueo con huella' })).toBeNull();
    await userEvent.press(screen.getByRole('button', { name: 'Menú de la cuenta' }));
    const sheet = screen.getByTestId('bottom-sheet');
    expect(
      await within(sheet).findByRole('switch', { name: 'Desbloqueo con huella' }),
    ).toBeOnTheScreen();
    expect(within(sheet).getByRole('button', { name: 'Cerrar sesión' })).toBeOnTheScreen();
  });
});
