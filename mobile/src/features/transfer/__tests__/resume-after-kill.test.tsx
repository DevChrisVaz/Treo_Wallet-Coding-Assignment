/**
 * La app muere a mitad de una transferencia (MOB-11): al reabrirla con sesión, el flujo se abre solo
 * y reanuda con la misma llave; la API responde con el estado real.
 */
import { screen, userEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

import { createFakeApi, json, problem, type FakeApi, type FakeReply } from '@/test-utils/fake-api';
import { luis, overview } from '@/test-utils/fixtures';
import { secureStoreMock } from '@/test-utils/native-mocks';
import { renderApp } from '@/test-utils/render-app';
import { draft, FROZEN_PAYLOAD, transfer } from '@/test-utils/transfer-fixtures';
import { PENDING_TRANSFER_KEY, savePendingTransfer } from '@/session/pending-transfer';

import { ResumePendingTransfer } from '../resume-pending-transfer';
import { TransferFlowScreen } from '../transfer-flow-screen';

const KEY = 'b6f1c6a2-3d4e-4f50-8a61-72b3c4d5e6f7';
const pendingDraft = { ...draft, beneficiaryId: luis.id };
const PAYLOAD = FROZEN_PAYLOAD.replace(draft.beneficiaryId, luis.id);

function apiWith(...createReplies: FakeReply[]): FakeApi {
  return createFakeApi()
    .on('GET', '/accounts', json(200, overview()))
    .on('GET', '/beneficiaries', json(200, { items: [luis] }))
    .on('POST', '/transfers', ...createReplies);
}

const seed = () => savePendingTransfer({ key: KEY, payload: PAYLOAD, draft: pendingDraft });

function Home() {
  return (
    <>
      <ResumePendingTransfer />
      <Text>Inicio</Text>
    </>
  );
}

describe('reanudar una transferencia tras cerrar la app', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('MOB-11 al abrir la app con un intento guardado, abre el flujo y muestra el comprobante real con la misma llave y los mismos bytes', async () => {
    const fake = apiWith(json(200, transfer(), { 'Idempotent-Replayed': 'true' }));
    await renderApp({ fake, routes: { index: Home, 'transfer/send': TransferFlowScreen }, seed });

    expect(await screen.findByText('Completada')).toBeOnTheScreen();
    expect(
      screen.getByText('Tu transferencia ya se había registrado; este es su estado actual.'),
    ).toBeOnTheScreen();
    const posts = fake.requestsTo('POST', '/transfers');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.headers['idempotency-key']).toBe(KEY);
    expect(posts[0]?.body).toBe(PAYLOAD);
    expect(secureStoreMock.entries()[PENDING_TRANSFER_KEY]).toBeUndefined();
  });

  test('MOB-11 si sigue sin red, queda el estado incierto con Reintentar y el intento guardado', async () => {
    const fake = apiWith('network-error');
    await renderApp({
      fake,
      routes: { 'transfer/send': TransferFlowScreen },
      initialUrl: `/transfer/send?beneficiaryId=${luis.id}`,
      seed,
    });
    for (const delay of [1500, 2500, 5000, 10_000, 20_000]) {
      await jest.advanceTimersByTimeAsync(delay);
    }

    expect(
      await screen.findByText('No pudimos confirmar el estado de tu transferencia'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeOnTheScreen();
    expect(secureStoreMock.entries()[PENDING_TRANSFER_KEY]).toBeDefined();

    fake.on('POST', '/transfers', json(200, transfer(), { 'Idempotent-Replayed': 'true' }));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Completada')).toBeOnTheScreen();
    expect(
      new Set(fake.requestsTo('POST', '/transfers').map((r) => r.headers['idempotency-key'])),
    ).toEqual(new Set([KEY]));
  });

  test('MOB-11 si la API rechaza el intento retomado, lo dice y no deja nada guardado', async () => {
    const fake = apiWith(problem(422, 'INSUFFICIENT_FUNDS'));
    await renderApp({
      fake,
      routes: { 'transfer/send': TransferFlowScreen },
      initialUrl: `/transfer/send?beneficiaryId=${luis.id}`,
      seed,
    });

    expect(await screen.findByRole('button', { name: 'Corregir' })).toBeOnTheScreen();
    expect(secureStoreMock.entries()[PENDING_TRANSFER_KEY]).toBeUndefined();
  });

  test('MOB-11 el texto del estado incierto explica que se guarda y se retoma al abrir la app', async () => {
    const fake = apiWith('network-error');
    await renderApp({
      fake,
      routes: { 'transfer/send': TransferFlowScreen },
      initialUrl: `/transfer/send?beneficiaryId=${luis.id}`,
      seed,
    });
    for (const delay of [1500, 2500, 5000, 10_000, 20_000]) {
      await jest.advanceTimersByTimeAsync(delay);
    }

    expect(await screen.findByText(/lo retomamos al abrirla/)).toBeOnTheScreen();
  });

  test('MOB-11 sin intento guardado, la app abre en Inicio y no navega', async () => {
    const fake = apiWith();
    await renderApp({ fake, routes: { index: Home, 'transfer/send': TransferFlowScreen } });

    expect(await screen.findByText('Inicio')).toBeOnTheScreen();
    expect(fake.requestsTo('POST', '/transfers')).toHaveLength(0);
  });
});
