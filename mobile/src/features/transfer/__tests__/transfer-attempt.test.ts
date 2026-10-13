import { randomUUID } from 'expo-crypto';

import {
  draft,
  fakeTransport,
  FROZEN_PAYLOAD,
  never,
  pendingOtp,
  problemError,
  rejects,
  resolves,
  transfer,
} from '@/test-utils/transfer-fixtures';

import { TransferAttempt } from '../transfer-attempt';

jest.mock('expo-crypto', () => ({ randomUUID: jest.fn(() => 'uuid-de-expo-crypto') }));

function keys(...values: string[]) {
  const queue = [...values];
  return jest.fn(() => queue.shift() ?? 'llave-sobrante');
}

const alwaysOnline = { subscribe: () => () => {} };

function setup(generateKey = keys('llave-1', 'llave-2', 'llave-3')) {
  const fake = fakeTransport();
  const attempt = new TransferAttempt({
    transport: fake.transport,
    generateKey,
    connectivity: alwaysOnline,
  });
  return { ...fake, attempt, generateKey };
}

describe('transferAttempt: llave e intento', () => {
  test('MOB-09 al pasar a revisión genera una llave y congela el payload que se enviará', () => {
    const { attempt, generateKey } = setup();
    expect(attempt.getState()).toEqual({ status: 'editing' });

    expect(attempt.review(draft)).toEqual({ ok: true });

    expect(generateKey).toHaveBeenCalledTimes(1);
    expect(attempt.getState()).toMatchObject({
      status: 'reviewing',
      key: 'llave-1',
      payload: FROZEN_PAYLOAD,
    });
  });

  test('MOB-09 por defecto la llave sale de randomUUID de expo-crypto', () => {
    const attempt = new TransferAttempt({
      transport: fakeTransport().transport,
      connectivity: alwaysOnline,
    });
    attempt.review(draft);
    expect(randomUUID).toHaveBeenCalled();
    expect(attempt.getState()).toMatchObject({ key: 'uuid-de-expo-crypto' });
  });

  test('MOB-08 no pasa a revisión con datos que el contrato rechaza', () => {
    const { attempt, generateKey } = setup();
    expect(attempt.review({ ...draft, amount: '100.005', reference: '12A45' })).toEqual({
      ok: false,
      errors: {
        amount: 'El monto admite máximo 2 decimales',
        reference: 'La referencia solo admite dígitos',
      },
    });
    expect(attempt.getState()).toEqual({ status: 'editing' });
    expect(generateKey).not.toHaveBeenCalled();
  });

  test('MOB-09 enviar usa la llave del intento y el payload congelado', async () => {
    const { attempt, transport, onCreate } = setup();
    onCreate(resolves({ transfer: transfer(), replayed: false }));
    attempt.review(draft);

    await attempt.submit();

    expect(transport.create).toHaveBeenCalledWith('llave-1', FROZEN_PAYLOAD);
  });

  test('MOB-09 un doble toque en Enviar hace una sola petición', async () => {
    const { attempt, transport, onCreate } = setup();
    onCreate(never());
    attempt.review(draft);

    void attempt.submit();
    void attempt.submit();
    await Promise.resolve();

    expect(transport.create).toHaveBeenCalledTimes(1);
    expect(attempt.getState()).toMatchObject({ status: 'sending', key: 'llave-1' });
  });

  test('MOB-09 editar descarta la llave y el siguiente envío usa una nueva', async () => {
    const { attempt, transport, onCreate } = setup();
    onCreate(resolves({ transfer: transfer(), replayed: false }));
    attempt.review(draft);
    attempt.edit();
    expect(attempt.getState()).toEqual({ status: 'editing' });

    attempt.review({ ...draft, amount: '1300' });
    await attempt.submit();

    expect(transport.create).toHaveBeenCalledTimes(1);
    expect(transport.create.mock.calls[0]?.[0]).toBe('llave-2');
  });

  test('MOB-09 tras un rechazo por saldo, corregir y enviar usa una llave distinta', async () => {
    const { attempt, transport, onCreate } = setup();
    onCreate(
      rejects(problemError(422, 'INSUFFICIENT_FUNDS', { transferId: 't-rechazada' })),
      resolves({ transfer: transfer(), replayed: false }),
    );
    attempt.review(draft);
    await attempt.submit();
    expect(attempt.getState()).toMatchObject({ status: 'rejected' });

    attempt.edit();
    attempt.review({ ...draft, amount: '100' });
    await attempt.submit();

    const usedKeys = transport.create.mock.calls.map(([key]) => key);
    expect(usedKeys).toEqual(['llave-1', 'llave-2']);
  });

  test('MOB-13 una respuesta COMPLETED termina el intento con la transferencia de la API', async () => {
    const { attempt, onCreate } = setup();
    onCreate(resolves({ transfer: transfer(), replayed: false }));
    attempt.review(draft);
    await attempt.submit();
    expect(attempt.getState()).toEqual({
      status: 'completed',
      transfer: transfer(),
      replayed: false,
    });
  });

  test('MOB-12 una respuesta PENDING_OTP pasa a pedir el código', async () => {
    const { attempt, onCreate } = setup();
    onCreate(resolves({ transfer: pendingOtp(), replayed: false }));
    attempt.review({ ...draft, amount: '15000.00' });
    await attempt.submit();
    expect(attempt.getState()).toMatchObject({ status: 'pendingOtp', transfer: pendingOtp() });
  });

  test('MOB-09 notifica a los suscriptores cada cambio de estado', async () => {
    const { attempt, onCreate } = setup();
    onCreate(resolves({ transfer: transfer(), replayed: false }));
    const seen: string[] = [];
    attempt.subscribe(() => seen.push(attempt.getState().status));
    attempt.review(draft);
    await attempt.submit();
    expect(seen).toEqual(['reviewing', 'sending', 'completed']);
  });
});
