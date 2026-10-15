import { act, screen, userEvent } from '@testing-library/react-native';

import { createFakeApi, json, problem, type FakeApi, type FakeReply } from '@/test-utils/fake-api';
import { luis, overview } from '@/test-utils/fixtures';
import { renderApp } from '@/test-utils/render-app';
import { pendingOtp, transfer } from '@/test-utils/transfer-fixtures';

import { TransferFlowScreen } from '../transfer-flow-screen';

const CONFIRM_PATH = `/transfers/${pendingOtp().id}/confirm`;
const RESEND_PATH = `/transfers/${pendingOtp().id}/otp/resend`;

function apiWith(created = pendingOtp(), ...confirmReplies: FakeReply[]): FakeApi {
  const fake = createFakeApi()
    .on('GET', '/accounts', json(200, overview()))
    .on('GET', '/beneficiaries', json(200, { items: [luis] }))
    .on('POST', '/transfers', json(201, created));
  if (confirmReplies.length) fake.on('POST', CONFIRM_PATH, ...confirmReplies);
  return fake;
}

async function reachOtp(fake: FakeApi) {
  await renderApp({
    fake,
    routes: { 'transfer/send': TransferFlowScreen },
    initialUrl: `/transfer/send?beneficiaryId=${luis.id}`,
  });
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  await user.type(await screen.findByLabelText('Monto'), '15000');
  await user.type(screen.getByLabelText('Concepto'), 'Renta');
  await user.type(screen.getByLabelText('Referencia (opcional)'), '1');
  await user.press(screen.getByRole('button', { name: 'Continuar' }));
  await user.press(await screen.findByRole('button', { name: 'Enviar' }));
  await screen.findByLabelText('Código de 6 dígitos');
  return user;
}

async function confirm(user: ReturnType<typeof userEvent.setup>, code: string) {
  const field = screen.getByLabelText('Código de 6 dígitos');
  await user.clear(field);
  await user.type(field, code);
  await user.press(screen.getByRole('button', { name: 'Confirmar' }));
}

describe('confirmación con OTP', () => {
  beforeEach(() => {
    // El reto simulado vence a las 16:46 UTC: faltan 5 minutos.
    jest.useFakeTimers({ now: new Date('2026-10-13T16:41:00Z') });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('MOB-12 muestra el correo enmascarado, el tiempo restante y los intentos que quedan', async () => {
    await reachOtp(apiWith());
    // Capturar con userEvent también avanza el reloj falso: se fija la hora antes del siguiente tic.
    jest.setSystemTime(new Date('2026-10-13T16:40:59Z'));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(
      screen.getByText('Te enviamos un código de 6 dígitos a an***@example.com.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('El código vence en 5:00.')).toBeOnTheScreen();
    expect(screen.getByText('Te quedan 3 intentos.')).toBeOnTheScreen();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(61_000);
    });
    expect(screen.getByText('El código vence en 3:59.')).toBeOnTheScreen();
  });

  test('MOB-12 con el código correcto muestra el estado COMPLETED que devuelve la API', async () => {
    const fake = apiWith(pendingOtp(), json(200, transfer({ amount: '15000.00' })));
    const user = await reachOtp(fake);
    await confirm(user, '482913');
    expect(await screen.findByText('Completada')).toBeOnTheScreen();
    expect(JSON.parse(fake.requestsTo('POST', CONFIRM_PATH)[0]?.body ?? '')).toEqual({
      otp: '482913',
    });
  });

  test('MOB-12 con un código incorrecto avisa cuántos intentos quedan y conserva la pantalla', async () => {
    const fake = apiWith(pendingOtp(), problem(422, 'OTP_INVALID', { attemptsRemaining: 1 }));
    const user = await reachOtp(fake);
    await confirm(user, '000000');
    expect(
      await screen.findByText('El código no es correcto. Te queda 1 intento.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Te queda 1 intento.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Código de 6 dígitos')).toBeOnTheScreen();
  });

  test('MOB-12 con los intentos agotados indica que la transferencia no se realizó', async () => {
    const fake = apiWith(pendingOtp(), problem(422, 'OTP_ATTEMPTS_EXHAUSTED', { transferId: 't' }));
    const user = await reachOtp(fake);
    await confirm(user, '000000');
    expect(
      await screen.findByText('Agotaste los intentos. Cancelamos la transferencia.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Fallida')).toBeOnTheScreen();
  });

  test('MOB-12 con el código vencido indica que terminó el tiempo y ofrece un nuevo intento', async () => {
    const fake = apiWith(pendingOtp(), problem(409, 'TRANSFER_EXPIRED'));
    const user = await reachOtp(fake);
    await confirm(user, '482913');
    expect(
      await screen.findByText('El código venció. Crea la transferencia de nuevo.'),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Intentar de nuevo' }));
    expect(screen.getByLabelText('Monto')).toHaveDisplayValue('15,000');
  });

  test('MOB-12 si el correo no se envió lo indica y permite reenviar el código', async () => {
    const failedDelivery = pendingOtp();
    failedDelivery.otp = { ...failedDelivery.otp!, deliveryStatus: 'FAILED' };
    const fake = apiWith(failedDelivery);
    fake.on('POST', RESEND_PATH, json(202, { ...pendingOtp().otp, resendsRemaining: 2 }));
    const user = await reachOtp(fake);

    expect(
      screen.getByText('No pudimos enviarte el código. Reenvíalo para recibir uno nuevo.'),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Reenviar código' }));

    expect(fake.requestsTo('POST', RESEND_PATH)).toHaveLength(1);
    expect(screen.queryByText(/No pudimos enviarte el código/)).toBeNull();
  });

  test('MOB-12 al llegar al límite de reenvíos oculta la opción y lo indica', async () => {
    const fake = apiWith();
    fake.on('POST', RESEND_PATH, problem(422, 'RESEND_LIMIT_REACHED'));
    const user = await reachOtp(fake);

    await user.press(screen.getByRole('button', { name: 'Reenviar código' }));

    expect(
      await screen.findByText('Ya reenviamos el código el máximo de veces.'),
    ).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Reenviar código' })).toBeNull();
  });

  test('MOB-12 si la respuesta de la confirmación se pierde, reintenta con el mismo código y muestra COMPLETED', async () => {
    const fake = apiWith(
      pendingOtp(),
      'network-error',
      json(200, transfer({ amount: '15000.00' })),
    );
    const user = await reachOtp(fake);
    await confirm(user, '482913');
    expect(
      await screen.findByText('Perdimos la conexión. Reintentaremos la confirmación (1 de 5).'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();

    // Avance síncrono: el asíncrono de fake-timers falla a veces cuando la vista del código se
    // desmonta (y limpia su intervalo) a mitad del avance.
    await act(async () => {
      jest.advanceTimersByTime(1500);
    });

    expect(await screen.findByText('Completada')).toBeOnTheScreen();
    const bodies = fake.requestsTo('POST', CONFIRM_PATH).map((request) => request.body);
    expect(bodies).toEqual(['{"otp":"482913"}', '{"otp":"482913"}']);
  });

  test('MOB-12 MOB-13 si la API dice que ya no está pendiente, el comprobante muestra el estado que devolvió', async () => {
    const fake = apiWith(
      pendingOtp(),
      problem(409, 'TRANSFER_NOT_PENDING', { transferStatus: 'REJECTED' }),
    );
    const user = await reachOtp(fake);
    await confirm(user, '482913');
    expect(await screen.findByText('Esta transferencia ya no está pendiente.')).toBeOnTheScreen();
    expect(screen.getByText('Rechazada')).toBeOnTheScreen();
    expect(screen.queryByText('Fallida')).toBeNull();
  });

  test('MOB-12 tras "Intentar de nuevo" el código empieza vacío y el nuevo intento usa otra llave', async () => {
    const fake = apiWith(pendingOtp(), problem(409, 'TRANSFER_EXPIRED'));
    const user = await reachOtp(fake);
    await confirm(user, '482913');
    await user.press(await screen.findByRole('button', { name: 'Intentar de nuevo' }));
    await user.press(screen.getByRole('button', { name: 'Continuar' }));
    await user.press(await screen.findByRole('button', { name: 'Enviar' }));

    expect(await screen.findByLabelText('Código de 6 dígitos')).toHaveDisplayValue('');
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    const keys = fake
      .requestsTo('POST', '/transfers')
      .map((request) => request.headers['idempotency-key']);
    expect(keys).toHaveLength(2);
    expect(keys[1]).not.toBe(keys[0]);
  });
});
