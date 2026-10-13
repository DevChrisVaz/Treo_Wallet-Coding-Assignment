import { act, screen, userEvent } from '@testing-library/react-native';

import { createFakeApi, json, problem, type FakeApi, type FakeReply } from '@/test-utils/fake-api';
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

async function send(fake: FakeApi, amount = '1500') {
  await renderApp({
    fake,
    routes: { 'transfer/send': TransferFlowScreen },
    initialUrl: `/transfer/send?beneficiaryId=${luis.id}`,
  });
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await user.type(await screen.findByLabelText('Monto'), amount);
  await user.type(screen.getByLabelText('Concepto'), 'Renta');
  await user.type(screen.getByLabelText('Referencia'), '1');
  await user.press(screen.getByRole('button', { name: 'Continuar' }));
  await user.press(await screen.findByRole('button', { name: 'Enviar' }));
  return user;
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Llaves enviadas; cada una debe ser un UUID v4 (nunca un header ausente). */
function keysOf(fake: FakeApi) {
  const keys = fake
    .requestsTo('POST', '/transfers')
    .map((request) => request.headers['idempotency-key']);
  for (const key of keys) expect(key).toMatch(UUID_V4);
  return keys;
}

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

describe('envío, estado incierto y rechazo', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('MOB-10 mientras reintenta indica que perdió la conexión y cuántos reintentos lleva', async () => {
    const fake = apiWith('network-error', 'hang');
    await send(fake);
    expect(
      await screen.findByText('Perdimos la conexión. Reintentaremos la misma operación (1 de 5).'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });

  test('MOB-11 si se agotan los reintentos lo dice, sin presentarla como completada ni fallida', async () => {
    const fake = apiWith('network-error');
    const user = await send(fake);
    for (const delay of [1500, 2500, 5000, 10_000, 20_000]) await advance(delay);

    expect(
      await screen.findByText('No pudimos confirmar el estado de tu transferencia'),
    ).toBeOnTheScreen();
    expect(screen.queryByText(/Completada|Rechazada|Fallida/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(fake.requestsTo('POST', '/transfers')).toHaveLength(6);

    fake.on('POST', '/transfers', 'hang');
    await user.press(screen.getByRole('button', { name: 'Reintentar' }));

    const keys = keysOf(fake);
    expect(keys).toHaveLength(7);
    expect(new Set(keys).size).toBe(1);
    const bodies = new Set(fake.requestsTo('POST', '/transfers').map((request) => request.body));
    expect(bodies.size).toBe(1);
  });

  test('MOB-14 un rechazo por saldo insuficiente muestra su mensaje y no se reintenta', async () => {
    const fake = apiWith(problem(422, 'INSUFFICIENT_FUNDS', { transferId: 't-1' }));
    await send(fake);
    expect(
      await screen.findByText('No tienes saldo suficiente para esta transferencia.'),
    ).toBeOnTheScreen();
    await advance(60_000);
    expect(fake.requestsTo('POST', '/transfers')).toHaveLength(1);
  });

  test('MOB-14 un rechazo por límite diario muestra lo que queda hoy', async () => {
    const fake = apiWith(
      problem(422, 'DAILY_LIMIT_EXCEEDED', { transferId: 't-1', remaining: '5000.00' }),
    );
    await send(fake, '6000');
    expect(
      await screen.findByText(
        'Esta transferencia supera lo que te queda del límite de hoy. Hoy te quedan $5,000.00.',
      ),
    ).toBeOnTheScreen();
  });

  test('MOB-09 tras un rechazo, corregir conserva los datos y el nuevo envío usa otra llave', async () => {
    const fake = apiWith(
      problem(422, 'INSUFFICIENT_FUNDS', { transferId: 't-1' }),
      json(201, transfer()),
    );
    const user = await send(fake);
    await user.press(await screen.findByRole('button', { name: 'Corregir' }));

    const amount = screen.getByLabelText('Monto');
    expect(amount).toHaveDisplayValue('1500');
    await user.clear(amount);
    await user.type(amount, '100');
    await user.press(screen.getByRole('button', { name: 'Continuar' }));
    await user.press(await screen.findByRole('button', { name: 'Enviar' }));

    const keys = keysOf(fake);
    expect(keys).toHaveLength(2);
    expect(keys[0]).not.toBe(keys[1]);
  });

  test('MOB-10 un 429 muestra cuánto falta y el reintento manual usa la misma llave', async () => {
    const fake = apiWith(
      problem(429, 'RATE_LIMITED', {}, { 'Retry-After': '20' }),
      json(201, transfer()),
    );
    const user = await send(fake);
    expect(
      await screen.findByText('Podrás reintentar en 20 s, con la misma operación.'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeDisabled();

    await advance(20_000);
    await user.press(screen.getByRole('button', { name: 'Reintentar' }));

    const keys = keysOf(fake);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  test('MOB-14 otro rechazo definitivo muestra el mensaje de su code y permite corregir', async () => {
    const fake = apiWith(problem(422, 'IDEMPOTENCY_KEY_REUSED'));
    await send(fake);
    expect(
      await screen.findByText(
        'Esta operación ya se envió con otros datos. Empieza una transferencia nueva.',
      ),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Corregir' })).toBeOnTheScreen();
    expect(screen.queryByText('Título técnico que la app no muestra')).toBeNull();
  });
});
