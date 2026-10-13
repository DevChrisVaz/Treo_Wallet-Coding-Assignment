import { NetworkError } from '@devchrisvaz/wallet-contract';

import {
  draft,
  fakeTransport,
  FROZEN_PAYLOAD,
  rejects,
  resolves,
  transfer,
} from '@/test-utils/transfer-fixtures';

import { MAX_RETRIES, TransferAttempt } from '../transfer-attempt';

const offline = () => rejects(new NetworkError(new TypeError('Network request failed')));

async function exhaustRetries() {
  const fake = fakeTransport();
  const attempt = new TransferAttempt({
    transport: fake.transport,
    generateKey: () => 'llave-1',
    connectivity: { subscribe: () => () => {} },
    random: () => 0.5,
  });
  attempt.review(draft);
  fake.onCreate(...Array(1 + MAX_RETRIES).fill(offline()));
  await attempt.submit();
  for (const delay of [1000, 2000, 4000, 8000, 16000]) {
    await jest.advanceTimersByTimeAsync(delay);
  }
  return { ...fake, attempt };
}

describe('transferAttempt: estado incierto', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('MOB-11 si los 5 reintentos fallan por falta de red, el estado queda incierto', async () => {
    const { attempt, transport } = await exhaustRetries();
    expect(transport.create).toHaveBeenCalledTimes(6);
    expect(attempt.getState()).toEqual({
      status: 'uncertain',
      key: 'llave-1',
      payload: FROZEN_PAYLOAD,
      draft,
    });
  });

  test('MOB-11 el reintento manual usa la misma llave y el mismo payload del intento original', async () => {
    const { attempt, transport, onCreate } = await exhaustRetries();
    onCreate(resolves({ transfer: transfer(), replayed: true }));

    await attempt.retry();

    expect(transport.create).toHaveBeenCalledTimes(7);
    expect(new Set(transport.create.mock.calls.map((call) => JSON.stringify(call)))).toEqual(
      new Set([JSON.stringify(['llave-1', FROZEN_PAYLOAD])]),
    );
    expect(attempt.getState()).toMatchObject({ status: 'completed', replayed: true });
  });

  test('MOB-11 si el reintento manual vuelve a fallar, aplica otra vez la política automática', async () => {
    const { attempt } = await exhaustRetries();
    await attempt.retry();
    expect(attempt.getState()).toMatchObject({ status: 'waitingRetry', retry: 1, key: 'llave-1' });
  });

  test('MOB-11 mientras el estado es incierto no se puede editar ni abrir otro intento', async () => {
    const { attempt } = await exhaustRetries();
    attempt.edit();
    await attempt.submit();
    expect(attempt.getState()).toMatchObject({ status: 'uncertain', key: 'llave-1' });
  });
});
