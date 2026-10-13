import { NetworkError } from '@devchrisvaz/wallet-contract';

import { RequestTimeoutError } from '@/api/client';
import {
  draft,
  fakeTransport,
  FROZEN_PAYLOAD,
  problemError,
  rejects,
  resolves,
  transfer,
} from '@/test-utils/transfer-fixtures';

import { MAX_RETRIES, retryDelay, TransferAttempt } from '../transfer-attempt';

const offline = () => rejects(new NetworkError(new TypeError('Network request failed')));

function setup(random = () => 0.5) {
  const fake = fakeTransport();
  const attempt = new TransferAttempt({
    transport: fake.transport,
    generateKey: () => 'llave-1',
    connectivity: { subscribe: () => () => {} },
    random,
  });
  attempt.review(draft);
  return { ...fake, attempt };
}

describe('transferAttempt: política de reintentos', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('MOB-10 la espera crece de 1 a 16 s con ±20 % de variación', () => {
    expect([1, 2, 3, 4, 5].map((retry) => retryDelay(retry, () => 0.5))).toEqual([
      1000, 2000, 4000, 8000, 16000,
    ]);
    expect(retryDelay(1, () => 0)).toBe(800);
    expect(retryDelay(5, () => 0)).toBe(12800);
    expect(retryDelay(5, () => 0.9999)).toBeLessThanOrEqual(19200);
    expect(retryDelay(5, () => 0.9999)).toBeGreaterThan(19000);
    expect(MAX_RETRIES).toBe(5);
  });

  test('MOB-10 ante pérdida de red reintenta con espera creciente, la misma llave y el mismo payload', async () => {
    const { attempt, transport, onCreate } = setup();
    onCreate(offline(), offline(), offline(), resolves({ transfer: transfer(), replayed: true }));

    await attempt.submit();
    expect(attempt.getState()).toMatchObject({ status: 'waitingRetry', retry: 1, delayMs: 1000 });
    await jest.advanceTimersByTimeAsync(999);
    expect(transport.create).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(transport.create).toHaveBeenCalledTimes(2);
    expect(attempt.getState()).toMatchObject({ status: 'waitingRetry', retry: 2, delayMs: 2000 });
    await jest.advanceTimersByTimeAsync(2000);
    expect(attempt.getState()).toMatchObject({ status: 'waitingRetry', retry: 3, delayMs: 4000 });
    await jest.advanceTimersByTimeAsync(4000);

    expect(attempt.getState()).toEqual({
      status: 'completed',
      transfer: transfer(),
      replayed: true,
    });
    expect(transport.create.mock.calls).toEqual(Array(4).fill(['llave-1', FROZEN_PAYLOAD]));
  });

  test('MOB-10 un 503 dos veces y después 201 muestra el resultado del 201', async () => {
    const { attempt, transport, onCreate } = setup();
    onCreate(
      rejects(problemError(503, 'INTERNAL_ERROR')),
      rejects(problemError(503, 'INTERNAL_ERROR')),
      resolves({ transfer: transfer(), replayed: false }),
    );

    await attempt.submit();
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(2000);

    expect(attempt.getState()).toMatchObject({ status: 'completed', transfer: transfer() });
    expect(transport.create).toHaveBeenCalledTimes(3);
  });

  test('MOB-10 un tiempo de espera agotado se reintenta igual que la falta de red', async () => {
    const { attempt, transport, onCreate } = setup();
    onCreate(
      rejects(new NetworkError(new RequestTimeoutError())),
      resolves({ transfer: transfer(), replayed: true }),
    );
    await attempt.submit();
    await jest.advanceTimersByTimeAsync(1000);
    expect(transport.create).toHaveBeenCalledTimes(2);
    expect(attempt.getState()).toMatchObject({ status: 'completed' });
  });

  test('MOB-10 un 422 por saldo insuficiente es definitivo y no se reintenta', async () => {
    const { attempt, transport, onCreate } = setup();
    onCreate(rejects(problemError(422, 'INSUFFICIENT_FUNDS', { transferId: 't-1' })));
    await attempt.submit();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(transport.create).toHaveBeenCalledTimes(1);
    expect(attempt.getState()).toMatchObject({
      status: 'rejected',
      error: { code: 'INSUFFICIENT_FUNDS' },
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  test('MOB-10 si el reintento recibe el rechazo ya registrado (réplica 422), lo muestra como definitivo', async () => {
    const { attempt, transport, onCreate } = setup();
    onCreate(offline(), rejects(problemError(422, 'INSUFFICIENT_FUNDS', { transferId: 't-1' })));
    await attempt.submit();
    await jest.advanceTimersByTimeAsync(1000);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(transport.create).toHaveBeenCalledTimes(2);
    expect(attempt.getState()).toMatchObject({ status: 'rejected' });
  });

  test('MOB-10 otros 4xx son definitivos', async () => {
    const { attempt, transport, onCreate } = setup();
    onCreate(rejects(problemError(422, 'IDEMPOTENCY_KEY_REUSED')));
    await attempt.submit();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(transport.create).toHaveBeenCalledTimes(1);
    expect(attempt.getState()).toMatchObject({
      status: 'error',
      error: { code: 'IDEMPOTENCY_KEY_REUSED' },
    });
  });

  test('MOB-10 un 429 no se reintenta solo y el reintento manual usa la misma llave y payload', async () => {
    const { attempt, transport, onCreate } = setup();
    onCreate(
      rejects(problemError(429, 'RATE_LIMITED')),
      resolves({ transfer: transfer(), replayed: false }),
    );
    await attempt.submit();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(transport.create).toHaveBeenCalledTimes(1);
    expect(attempt.getState()).toMatchObject({ status: 'rateLimited', key: 'llave-1' });

    await attempt.retry();

    expect(transport.create.mock.calls).toEqual([
      ['llave-1', FROZEN_PAYLOAD],
      ['llave-1', FROZEN_PAYLOAD],
    ]);
    expect(attempt.getState()).toMatchObject({ status: 'completed' });
  });

  test('MOB-10 hace como máximo 5 reintentos automáticos', async () => {
    const { attempt, transport, onCreate } = setup();
    onCreate(offline());
    await attempt.submit();
    for (const delay of [1000, 2000, 4000, 8000, 16000]) {
      await jest.advanceTimersByTimeAsync(delay);
    }
    await jest.advanceTimersByTimeAsync(120_000);
    expect(transport.create).toHaveBeenCalledTimes(1 + MAX_RETRIES);
    expect(attempt.getState().status).not.toBe('waitingRetry');
    expect(jest.getTimerCount()).toBe(0);
  });

  test('MOB-10 al descartar el intento cancela el reintento pendiente', async () => {
    const { attempt, transport, onCreate } = setup();
    onCreate(offline());
    await attempt.submit();
    attempt.dispose();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(transport.create).toHaveBeenCalledTimes(1);
  });
});
