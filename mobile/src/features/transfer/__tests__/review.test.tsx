import { act, screen, userEvent } from '@testing-library/react-native';

import { createFakeApi, json, type FakeApi, type FakeReply } from '@/test-utils/fake-api';
import { luis, overview } from '@/test-utils/fixtures';
import { renderApp } from '@/test-utils/render-app';
import { transfer } from '@/test-utils/transfer-fixtures';

import { TransferFlowScreen } from '../transfer-flow-screen';

function apiWith(...createReplies: FakeReply[]): FakeApi {
  return createFakeApi()
    .on('GET', '/accounts', json(200, overview()))
    .on('GET', '/beneficiaries', json(200, { items: [luis] }))
    .on('POST', '/transfers', ...createReplies);
}

async function review(fake: FakeApi, amount: string, fakeTimers = false) {
  await renderApp({
    fake,
    routes: { 'transfer/send': TransferFlowScreen },
    initialUrl: `/transfer/send?beneficiaryId=${luis.id}`,
  });
  const user = userEvent.setup(fakeTimers ? { advanceTimers: jest.advanceTimersByTime } : {});
  await user.type(await screen.findByLabelText('Monto'), amount);
  await user.type(screen.getByLabelText('Concepto'), 'Renta de octubre');
  await user.type(screen.getByLabelText('Referencia (opcional)'), '1234567');
  await user.press(screen.getByRole('button', { name: 'Continuar' }));
  return user;
}

describe('confirmación previa', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  test('MOB-09 el resumen muestra cuenta de origen, beneficiario, monto, concepto y referencia', async () => {
    await review(apiWith(json(201, transfer())), '1500.5');

    expect(await screen.findByText('Revisa tu transferencia')).toBeOnTheScreen();
    expect(screen.getByText('$1,500.50')).toBeOnTheScreen();
    expect(screen.getByText('Principal · •••• 9719')).toBeOnTheScreen();
    expect(screen.getByText('Luis · •••• 5678')).toBeOnTheScreen();
    expect(screen.getByText('Renta de octubre')).toBeOnTheScreen();
    expect(screen.getByText('1234567')).toBeOnTheScreen();
    expect(screen.queryByText(/código de confirmación/)).toBeNull();
  });

  test('MOB-09 con un monto mayor a 10,000.00 avisa que se enviará un código al correo', async () => {
    await review(apiWith(json(201, transfer())), '15000.00');
    expect(
      await screen.findByText(
        'Como el monto es mayor a $10,000.00, te enviaremos un código de confirmación a tu correo.',
      ),
    ).toBeOnTheScreen();
  });

  test('MOB-09 con exactamente 10,000.00 no pide código', async () => {
    await review(apiWith(json(201, transfer())), '10000.00');
    await screen.findByText('Revisa tu transferencia');
    expect(screen.queryByText(/código de confirmación/)).toBeNull();
  });

  test('MOB-09 un doble toque en Enviar hace una sola petición y el botón queda deshabilitado', async () => {
    jest.useFakeTimers();
    const fake = apiWith('network-error', 'hang');
    const user = await review(fake, '1500', true);
    const send = await screen.findByRole('button', { name: 'Enviar' });

    await user.press(send);
    await user.press(send);

    expect(fake.requestsTo('POST', '/transfers')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeBusy();
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();

    // Mientras espera el reintento sigue deshabilitado.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1500);
    });
    expect(fake.requestsTo('POST', '/transfers')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });

  test('MOB-09 Editar vuelve a la captura con los datos y sin enviar nada', async () => {
    const fake = apiWith(json(201, transfer()));
    const user = await review(fake, '1500');
    await user.press(await screen.findByRole('button', { name: 'Editar' }));
    expect(screen.getByLabelText('Monto')).toHaveDisplayValue('1,500');
    expect(screen.getByLabelText('Concepto')).toHaveDisplayValue('Renta de octubre');
    expect(fake.requestsTo('POST', '/transfers')).toHaveLength(0);
  });
});
