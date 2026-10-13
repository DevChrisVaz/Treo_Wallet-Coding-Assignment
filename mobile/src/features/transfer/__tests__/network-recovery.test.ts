import { NetworkError } from '@devchrisvaz/wallet-contract';

import { netInfoMock } from '@/test-utils/native-mocks';
import {
  draft,
  fakeTransport,
  FROZEN_PAYLOAD,
  problemError,
  rejects,
  resolves,
  transfer,
} from '@/test-utils/transfer-fixtures';

import { netInfoConnectivity } from '../connectivity';
import { TransferAttempt } from '../transfer-attempt';

const offline = () => rejects(new NetworkError(new TypeError('Network request failed')));

function setup() {
  const fake = fakeTransport();
  const attempt = new TransferAttempt({
    transport: fake.transport,
    generateKey: () => 'llave-1',
    connectivity: netInfoConnectivity,
    random: () => 0.5,
  });
  attempt.review(draft);
  return { ...fake, attempt };
}

describe('transferAttempt: red recuperada', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('MOB-10 al recuperar la conexión reintenta de inmediato y cancela la espera pendiente', async () => {
    const { attempt, transport, onCreate } = setup();
    onCreate(offline(), offline(), resolves({ transfer: transfer(), replayed: true }));
    netInfoMock.setConnected(false);

    await attempt.submit();
    await jest.advanceTimersByTimeAsync(1000);
    expect(attempt.getState()).toMatchObject({ status: 'waitingRetry', retry: 2, delayMs: 2000 });

    netInfoMock.setConnected(true);
    await jest.advanceTimersByTimeAsync(0);

    expect(transport.create).toHaveBeenCalledTimes(3);
    expect(transport.create.mock.calls[2]).toEqual(['llave-1', FROZEN_PAYLOAD]);
    expect(attempt.getState()).toMatchObject({ status: 'completed', replayed: true });
    expect(jest.getTimerCount()).toBe(0);
    expect(netInfoMock.listenerCount()).toBe(0);
  });

  test('MOB-10 si la red ya estaba disponible (5xx), espera el plazo aunque NetInfo avise', async () => {
    const { attempt, transport, onCreate } = setup();
    onCreate(
      rejects(problemError(503, 'INTERNAL_ERROR')),
      resolves({ transfer: transfer(), replayed: false }),
    );

    await attempt.submit();
    netInfoMock.setConnected(true);
    await jest.advanceTimersByTimeAsync(999);
    expect(transport.create).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(transport.create).toHaveBeenCalledTimes(2);
  });

  test('MOB-10 deja de escuchar la red al terminar el intento o al descartarlo', async () => {
    const { attempt, onCreate } = setup();
    onCreate(offline());
    netInfoMock.setConnected(false);
    await attempt.submit();
    expect(netInfoMock.listenerCount()).toBe(1);
    attempt.dispose();
    expect(netInfoMock.listenerCount()).toBe(0);
  });
});
