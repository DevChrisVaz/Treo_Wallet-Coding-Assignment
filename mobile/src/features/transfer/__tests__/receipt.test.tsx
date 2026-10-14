import { screen, userEvent, waitFor } from '@testing-library/react-native';

import { HomeScreen } from '@/features/accounts/home-screen';
import { createFakeApi, json, type FakeApi } from '@/test-utils/fake-api';
import { ahorro, luis, overview, principal } from '@/test-utils/fixtures';
import { renderApp } from '@/test-utils/render-app';
import { transfer } from '@/test-utils/transfer-fixtures';
import { theme } from '@/theme';

import { TransferFlowScreen } from '../transfer-flow-screen';

const fromApi = transfer({
  amount: '1500.00',
  concept: 'Renta de octubre',
  reference: '7',
  completedAt: '2026-10-13T16:42:00Z',
});

async function completeTransfer(fake: FakeApi, expectedBadge = 'Completada') {
  const rendered = await renderApp({
    fake,
    routes: { index: HomeScreen, 'transfer/send': TransferFlowScreen },
    initialUrl: `/transfer/send?beneficiaryId=${luis.id}`,
  });
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText('Monto'), '1500');
  await user.type(screen.getByLabelText('Concepto'), 'Renta');
  await user.type(screen.getByLabelText('Referencia'), '1');
  await user.press(screen.getByRole('button', { name: 'Continuar' }));
  await user.press(await screen.findByRole('button', { name: 'Enviar' }));
  await screen.findByText(expectedBadge);
  return { ...rendered, user };
}

describe('comprobante', () => {
  test('MOB-13 el comprobante muestra los datos que devolvió la API, no los capturados', async () => {
    const fake = createFakeApi()
      .on('GET', '/accounts', json(200, overview()))
      .on('GET', '/beneficiaries', json(200, { items: [luis] }))
      .on('POST', '/transfers', json(201, fromApi));
    await completeTransfer(fake);

    expect(screen.getByText('$1,500.00')).toBeOnTheScreen();
    expect(screen.getByText('Renta de octubre')).toBeOnTheScreen();
    expect(screen.queryByText('Renta')).toBeNull();
    expect(screen.getByText('7')).toBeOnTheScreen();
    expect(screen.getByText('Principal · •••• 9719')).toBeOnTheScreen();
    expect(screen.getByText('Luis · •••• 5678')).toBeOnTheScreen();
    expect(screen.getByText('13 oct 2026, 10:42')).toBeOnTheScreen();
    expect(screen.getByText(fromApi.id)).toBeOnTheScreen();
  });

  test('DSG-10 el comprobante lleva la insignia del estado con su tono', async () => {
    const fake = createFakeApi()
      .on('GET', '/accounts', json(200, overview()))
      .on('GET', '/beneficiaries', json(200, { items: [luis] }))
      .on('POST', '/transfers', json(201, fromApi));
    await completeTransfer(fake);
    expect(screen.getByText('Completada')).toHaveStyle({ color: theme.colors.status.success.fg });
  });

  test('MOB-13 al completar se vuelven a consultar los saldos y los movimientos', async () => {
    const after = overview([{ ...principal, balance: '23500.00' }, ahorro]);
    const fake = createFakeApi()
      .on('GET', '/accounts', json(200, overview()), json(200, after))
      .on('GET', '/beneficiaries', json(200, { items: [luis] }))
      .on('POST', '/transfers', json(201, fromApi));
    const { user } = await completeTransfer(fake);

    await waitFor(() => expect(fake.requestsTo('GET', '/accounts')).toHaveLength(2));
    await user.press(screen.getByRole('button', { name: 'Ver mis cuentas' }));

    expect(await screen.findByText('$23,500.00')).toBeOnTheScreen();
    expect(screen.queryByText('$25,000.00')).toBeNull();
  });

  test('MOB-13 la caché de movimientos queda invalidada al completar', async () => {
    const fake = createFakeApi()
      .on('GET', '/accounts', json(200, overview()))
      .on('GET', '/beneficiaries', json(200, { items: [luis] }))
      .on('POST', '/transfers', 'hang');
    const rendered = await renderApp({
      fake,
      routes: { 'transfer/send': TransferFlowScreen },
      initialUrl: `/transfer/send?beneficiaryId=${luis.id}`,
    });
    rendered.services.queryClient.setQueryData(['accounts', principal.id, 'movements'], []);
    fake.on('POST', '/transfers', json(201, fromApi));
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Monto'), '1500');
    await user.type(screen.getByLabelText('Concepto'), 'Renta');
    await user.type(screen.getByLabelText('Referencia'), '1');
    await user.press(screen.getByRole('button', { name: 'Continuar' }));
    await user.press(await screen.findByRole('button', { name: 'Enviar' }));
    await screen.findByText('Completada');

    expect(
      rendered.services.queryClient.getQueryState(['accounts', principal.id, 'movements'])
        ?.isInvalidated,
    ).toBe(true);
  });
});

describe('estados de las programadas', () => {
  test('MOB-23 una transferencia en SCHEDULED muestra "Programada" con el tono informativo y sin error', async () => {
    const scheduled = transfer({
      status: 'SCHEDULED',
      scheduledFor: '2026-10-20',
      completedAt: null,
    });
    const fake = createFakeApi()
      .on('GET', '/accounts', json(200, overview()))
      .on('GET', '/beneficiaries', json(200, { items: [luis] }))
      .on('POST', '/transfers', json(201, scheduled));
    await completeTransfer(fake, 'Programada');

    expect(screen.getByText('Programada')).toHaveStyle({ color: theme.colors.status.info.fg });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('MOB-23 el flujo de transferencia no ofrece elegir una fecha de envío', async () => {
    const fake = createFakeApi()
      .on('GET', '/accounts', json(200, overview()))
      .on('GET', '/beneficiaries', json(200, { items: [luis] }));
    await renderApp({
      fake,
      routes: { 'transfer/send': TransferFlowScreen },
      initialUrl: `/transfer/send?beneficiaryId=${luis.id}`,
    });

    await screen.findByLabelText('Monto');
    expect(screen.queryByText(/programar/i)).toBeNull();
    expect(screen.queryByLabelText(/fecha/i)).toBeNull();
  });
});
