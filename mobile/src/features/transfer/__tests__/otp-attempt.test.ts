import { NetworkError } from '@devchrisvaz/wallet-contract';

import {
  draft,
  fakeTransport,
  pendingOtp,
  problemError,
  rejects,
  resolves,
  transfer,
} from '@/test-utils/transfer-fixtures';

import { TransferAttempt } from '../transfer-attempt';

const offline = () => rejects(new NetworkError(new TypeError('Network request failed')));

async function atOtp() {
  const fake = fakeTransport();
  const attempt = new TransferAttempt({
    transport: fake.transport,
    generateKey: () => 'llave-1',
    connectivity: { subscribe: () => () => {} },
    random: () => 0.5,
  });
  fake.onCreate(resolves({ transfer: pendingOtp(), replayed: false }));
  attempt.review({ ...draft, amount: '15000.00' });
  await attempt.submit();
  return { ...fake, attempt };
}

describe('transferAttempt: confirmación con OTP', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('MOB-12 el código correcto completa la transferencia con la respuesta de la API', async () => {
    const { attempt, transport, onConfirm } = await atOtp();
    onConfirm(resolves(transfer({ amount: '15000.00' })));
    await attempt.confirmOtp('123456');
    expect(transport.confirm).toHaveBeenCalledWith(pendingOtp().id, '123456');
    expect(attempt.getState()).toMatchObject({
      status: 'completed',
      transfer: { status: 'COMPLETED', amount: '15000.00' },
    });
  });

  test('MOB-12 un código incorrecto conserva la captura del código con los intentos que quedan', async () => {
    const { attempt, onConfirm } = await atOtp();
    onConfirm(rejects(problemError(422, 'OTP_INVALID', { attemptsRemaining: 1 })));
    await attempt.confirmOtp('000000');
    const state = attempt.getState();
    expect(state).toMatchObject({ status: 'pendingOtp', otpError: { code: 'OTP_INVALID' } });
    expect(state.status === 'pendingOtp' && state.transfer.otp?.attemptsRemaining).toBe(1);
  });

  test('MOB-12 con los intentos agotados la transferencia queda fallida', async () => {
    const { attempt, onConfirm } = await atOtp();
    onConfirm(rejects(problemError(422, 'OTP_ATTEMPTS_EXHAUSTED', { transferId: 't' })));
    await attempt.confirmOtp('000000');
    expect(attempt.getState()).toMatchObject({
      status: 'failed',
      error: { code: 'OTP_ATTEMPTS_EXHAUSTED' },
    });
  });

  test('MOB-12 con el código vencido la transferencia queda vencida y se puede iniciar otro intento', async () => {
    const { attempt, onConfirm } = await atOtp();
    onConfirm(rejects(problemError(409, 'TRANSFER_EXPIRED')));
    await attempt.confirmOtp('123456');
    expect(attempt.getState()).toMatchObject({ status: 'expired' });
    attempt.restart();
    expect(attempt.getState()).toEqual({ status: 'editing' });
  });

  test('MOB-12 si la respuesta de la confirmación se pierde, reintenta con el mismo código', async () => {
    const { attempt, transport, onConfirm } = await atOtp();
    onConfirm(offline(), resolves(transfer({ amount: '15000.00' })));
    await attempt.confirmOtp('123456');
    expect(attempt.getState()).toMatchObject({ status: 'waitingOtpRetry', retry: 1 });
    await jest.advanceTimersByTimeAsync(1000);
    expect(transport.confirm.mock.calls).toEqual([
      [pendingOtp().id, '123456'],
      [pendingOtp().id, '123456'],
    ]);
    expect(attempt.getState()).toMatchObject({ status: 'completed' });
  });

  test('MOB-12 tras agotar los reintentos de la confirmación, el estado es incierto y se reintenta con el mismo código', async () => {
    const { attempt, transport, onConfirm } = await atOtp();
    onConfirm(offline());
    await attempt.confirmOtp('123456');
    for (const delay of [1000, 2000, 4000, 8000, 16000]) {
      await jest.advanceTimersByTimeAsync(delay);
    }
    expect(attempt.getState()).toMatchObject({ status: 'otpUncertain', code: '123456' });
    onConfirm(resolves(transfer()));
    await attempt.retry();
    expect(transport.confirm).toHaveBeenLastCalledWith(pendingOtp().id, '123456');
    expect(attempt.getState()).toMatchObject({ status: 'completed' });
  });

  test('MOB-12 reenviar actualiza el reto y un límite de reenvíos lo deja sin reenvíos', async () => {
    const { attempt, transport } = await atOtp();
    const challenge = {
      ...pendingOtp().otp!,
      deliveryStatus: 'SENT' as const,
      resendsRemaining: 2,
    };
    transport.resend = jest
      .fn()
      .mockResolvedValueOnce(challenge)
      .mockRejectedValueOnce(problemError(422, 'RESEND_LIMIT_REACHED'));

    await attempt.resendOtp();
    let state = attempt.getState();
    expect(state.status === 'pendingOtp' && state.transfer.otp).toEqual(challenge);

    await attempt.resendOtp();
    state = attempt.getState();
    expect(state).toMatchObject({
      status: 'pendingOtp',
      resendError: { code: 'RESEND_LIMIT_REACHED' },
    });
    expect(state.status === 'pendingOtp' && state.transfer.otp?.resendsRemaining).toBe(0);
  });

  test('MOB-12 un doble toque en Confirmar hace una sola petición', async () => {
    const { attempt, transport, onConfirm } = await atOtp();
    onConfirm(() => new Promise(() => {}));
    void attempt.confirmOtp('123456');
    void attempt.confirmOtp('123456');
    await Promise.resolve();
    expect(transport.confirm).toHaveBeenCalledTimes(1);
  });
});
