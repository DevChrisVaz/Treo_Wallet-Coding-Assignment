import { NetworkError } from '@devchrisvaz/wallet-contract';

import {
  clearPendingTransfer,
  loadPendingTransfer,
  PENDING_TRANSFER_KEY,
  savePendingTransfer,
} from '@/session/pending-transfer';
import { secureStoreMock } from '@/test-utils/native-mocks';
import {
  draft,
  fakeTransport,
  FROZEN_PAYLOAD,
  never,
  problemError,
  rejects,
  resolves,
  transfer,
} from '@/test-utils/transfer-fixtures';

import { MAX_RETRIES, TransferAttempt, type PendingStore } from '../transfer-attempt';

/** El almacenamiento seguro real (simulado en memoria), como lo usa la app. */
const store: PendingStore = {
  save: (frozen) => savePendingTransfer(frozen),
  load: () => loadPendingTransfer(),
  clear: () => clearPendingTransfer(),
};

const offline = () => rejects(new NetworkError(new TypeError('Network request failed')));

/** Un "arranque" de la app: intento nuevo con su propio transporte y la misma persistencia. */
function boot(key = 'llave-1') {
  const fake = fakeTransport();
  const attempt = new TransferAttempt({
    transport: fake.transport,
    generateKey: () => key,
    connectivity: { subscribe: () => () => {} },
    random: () => 0.5,
    pending: store,
  });
  return { ...fake, attempt };
}

const saved = () => secureStoreMock.entries()[PENDING_TRANSFER_KEY];

describe('transferencia que sobrevive a que la app se cierre', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('MOB-11 al revisar todavía no se guarda nada; al enviar se guarda antes de salir la petición', async () => {
    const { attempt, transport, onCreate } = boot();
    onCreate(never());
    attempt.review(draft);
    expect(saved()).toBeUndefined();

    let savedBeforeRequest: string | undefined;
    transport.create.mockImplementationOnce(async () => {
      savedBeforeRequest = saved();
      return new Promise<never>(() => {});
    });
    void attempt.submit();
    await jest.advanceTimersByTimeAsync(0);

    expect(JSON.parse(savedBeforeRequest ?? 'null')).toMatchObject({
      key: 'llave-1',
      payload: FROZEN_PAYLOAD,
      draft,
    });
  });

  test('MOB-11 al completarse la transferencia se borra el intento guardado', async () => {
    const { attempt, onCreate } = boot();
    onCreate(resolves({ transfer: transfer(), replayed: false }));
    attempt.review(draft);
    await attempt.submit();

    expect(attempt.getState().status).toBe('completed');
    expect(saved()).toBeUndefined();
  });

  test('MOB-11 si queda pendiente de OTP también se borra: la transferencia ya existe en la API', async () => {
    const { attempt, onCreate } = boot();
    onCreate(resolves({ transfer: transfer({ status: 'PENDING_OTP' }), replayed: false }));
    attempt.review(draft);
    await attempt.submit();

    expect(attempt.getState().status).toBe('pendingOtp');
    expect(saved()).toBeUndefined();
  });

  test('MOB-11 un rechazo 4xx definitivo borra el intento guardado', async () => {
    const { attempt, onCreate } = boot();
    onCreate(rejects(problemError(422, 'INSUFFICIENT_FUNDS')));
    attempt.review(draft);
    await attempt.submit();
    expect(attempt.getState().status).toBe('rejected');
    expect(saved()).toBeUndefined();

    const other = boot('llave-2');
    other.onCreate(rejects(problemError(400, 'VALIDATION_FAILED')));
    other.attempt.review(draft);
    await other.attempt.submit();
    expect(other.attempt.getState().status).toBe('error');
    expect(saved()).toBeUndefined();
  });

  test('MOB-11 mientras reintenta y en el estado incierto el intento sigue guardado', async () => {
    const { attempt, onCreate } = boot();
    onCreate(offline());
    attempt.review(draft);
    await attempt.submit();
    expect(attempt.getState().status).toBe('waitingRetry');
    expect(saved()).toBeDefined();

    for (const delay of [1000, 2000, 4000, 8000, 16000]) {
      await jest.advanceTimersByTimeAsync(delay);
    }
    expect(attempt.getState().status).toBe('uncertain');
    expect(JSON.parse(saved() ?? 'null')).toMatchObject({ key: 'llave-1' });
  });

  test('MOB-11 el reintento manual desde incierto que termina en éxito borra el intento guardado', async () => {
    const { attempt, onCreate } = boot();
    onCreate(...Array(1 + MAX_RETRIES).fill(offline()));
    attempt.review(draft);
    await attempt.submit();
    for (const delay of [1000, 2000, 4000, 8000, 16000]) {
      await jest.advanceTimersByTimeAsync(delay);
    }
    onCreate(resolves({ transfer: transfer(), replayed: true }));

    await attempt.retry();

    expect(attempt.getState().status).toBe('completed');
    expect(saved()).toBeUndefined();
  });

  test('MOB-11 tras reabrir la app a mitad del envío, reanuda con la MISMA llave y los MISMOS bytes y muestra el estado real', async () => {
    const first = boot('llave-1');
    first.onCreate(never());
    first.attempt.review(draft);
    void first.attempt.submit();
    await jest.advanceTimersByTimeAsync(0);
    first.attempt.dispose(); // el sistema mata la app: la memoria se pierde, lo guardado no

    const second = boot('llave-distinta-que-no-debe-usarse');
    second.onCreate(resolves({ transfer: transfer(), replayed: true }));
    await second.attempt.resume();

    expect(second.transport.create).toHaveBeenCalledTimes(1);
    expect(second.transport.create).toHaveBeenCalledWith('llave-1', FROZEN_PAYLOAD);
    expect(second.attempt.getState()).toEqual({
      status: 'completed',
      transfer: transfer(),
      replayed: true,
    });
    expect(saved()).toBeUndefined();
  });

  test('MOB-11 al reabrir tras quedar incierta y seguir sin red, vuelve a incierto con "Reintentar" y conserva la llave', async () => {
    const first = boot('llave-1');
    first.onCreate(...Array(1 + MAX_RETRIES).fill(offline()));
    first.attempt.review(draft);
    await first.attempt.submit();
    for (const delay of [1000, 2000, 4000, 8000, 16000]) {
      await jest.advanceTimersByTimeAsync(delay);
    }
    first.attempt.dispose();

    const second = boot('otra');
    second.onCreate(...Array(1 + MAX_RETRIES).fill(offline()));
    await second.attempt.resume();
    for (const delay of [1000, 2000, 4000, 8000, 16000]) {
      await jest.advanceTimersByTimeAsync(delay);
    }

    expect(second.attempt.getState()).toEqual({
      status: 'uncertain',
      key: 'llave-1',
      payload: FROZEN_PAYLOAD,
      draft,
    });
    expect(new Set(second.transport.create.mock.calls.map((call) => JSON.stringify(call)))).toEqual(
      new Set([JSON.stringify(['llave-1', FROZEN_PAYLOAD])]),
    );
    expect(saved()).toBeDefined();
  });

  test('MOB-11 al reabrir, si la API responde un rechazo 4xx, lo muestra y borra el intento', async () => {
    await store.save({ key: 'llave-1', payload: FROZEN_PAYLOAD, draft });
    const { attempt, onCreate } = boot();
    onCreate(rejects(problemError(422, 'DAILY_LIMIT_EXCEEDED')));

    await attempt.resume();

    expect(attempt.getState().status).toBe('rejected');
    expect(saved()).toBeUndefined();
  });

  test('MOB-11 sin intento guardado, o con uno de más de 24 horas, reanudar no envía nada', async () => {
    const none = boot();
    await none.attempt.resume();
    expect(none.transport.create).not.toHaveBeenCalled();
    expect(none.attempt.getState()).toEqual({ status: 'editing' });

    await savePendingTransfer({ key: 'llave-1', payload: FROZEN_PAYLOAD, draft }, () => 0);
    jest.setSystemTime(24 * 60 * 60 * 1000 + 1);
    const old = boot();
    await old.attempt.resume();
    expect(old.transport.create).not.toHaveBeenCalled();
    expect(secureStoreMock.entries()).toEqual({});
  });

  test('MOB-11 reanudar dos veces seguidas solo envía una vez', async () => {
    await store.save({ key: 'llave-1', payload: FROZEN_PAYLOAD, draft });
    const { attempt, transport, onCreate } = boot();
    onCreate(never());

    void attempt.resume();
    void attempt.resume();
    await jest.advanceTimersByTimeAsync(0);

    expect(transport.create).toHaveBeenCalledTimes(1);
  });

  test('MOB-11 si la persona descarta el intento rechazado con Corregir, no queda nada guardado', async () => {
    const { attempt, onCreate } = boot();
    onCreate(rejects(problemError(422, 'INSUFFICIENT_FUNDS')));
    attempt.review(draft);
    await attempt.submit();
    await store.save({ key: 'llave-1', payload: FROZEN_PAYLOAD, draft });

    attempt.edit();
    await jest.advanceTimersByTimeAsync(0);

    expect(attempt.getState()).toEqual({ status: 'editing' });
    expect(saved()).toBeUndefined();
  });
});
