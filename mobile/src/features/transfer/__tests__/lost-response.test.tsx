/**
 * Caso borde del enunciado: pérdida de red a mitad de una transferencia (MOB-10, MOB-13). Una API
 * simulada con idempotencia real: guarda la transferencia por llave, la completa y pierde la
 * respuesta; al volver la red, el reintento con la misma llave recibe la transferencia original.
 */
import type { Transfer } from '@devchrisvaz/wallet-contract';
import { screen, userEvent } from '@testing-library/react-native';

import { createFakeApi, json, problem, type RecordedRequest } from '@/test-utils/fake-api';
import { luis, overview } from '@/test-utils/fixtures';
import { netInfoMock } from '@/test-utils/native-mocks';
import { renderApp } from '@/test-utils/render-app';
import { transfer } from '@/test-utils/transfer-fixtures';

import { TransferFlowScreen } from '../transfer-flow-screen';

/** Servidor con la semántica de idempotencia de la API (api-ledger, D1). */
function idempotentServer() {
  const byKey = new Map<string, { body: string; transfer: Transfer }>();
  let loseNextResponse = true;
  return {
    byKey,
    handle(request: RecordedRequest) {
      const key = request.headers['idempotency-key'] ?? '';
      const body = request.body ?? '';
      const existing = byKey.get(key);
      if (existing) {
        if (existing.body !== body) return problem(422, 'IDEMPOTENCY_KEY_REUSED');
        return json(200, existing.transfer, { 'Idempotent-Replayed': 'true' });
      }
      const created = transfer({ id: `transfer-${byKey.size + 1}` });
      byKey.set(key, { body, transfer: created });
      if (loseNextResponse) {
        loseNextResponse = false;
        // La API completó la transferencia, pero la respuesta no llega: el teléfono perdió la red.
        netInfoMock.setConnected(false);
        throw new TypeError('Network request failed');
      }
      return json(201, created);
    },
  };
}

describe('pérdida de red a mitad de una transferencia', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test('MOB-10 la respuesta se pierde, la red vuelve y el reintento con la misma llave recibe el COMPLETED original, sin una segunda transferencia', async () => {
    const server = idempotentServer();
    const fake = createFakeApi()
      .on('GET', '/accounts', json(200, overview()))
      .on('GET', '/beneficiaries', json(200, { items: [luis] }))
      .on('POST', '/transfers', (request) => server.handle(request));
    await renderApp({
      fake,
      routes: { 'transfer/send': TransferFlowScreen },
      initialUrl: `/transfer/send?beneficiaryId=${luis.id}`,
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.type(await screen.findByLabelText('Monto'), '1500');
    await user.type(screen.getByLabelText('Concepto'), 'Renta');
    await user.type(screen.getByLabelText('Referencia (opcional)'), '1');
    await user.press(screen.getByRole('button', { name: 'Continuar' }));

    await user.press(await screen.findByRole('button', { name: 'Enviar' }));
    expect(
      await screen.findByText('Perdimos la conexión. Reintentaremos la misma operación (1 de 5).'),
    ).toBeOnTheScreen();

    // Vuelve la red: el reintento sale de inmediato, sin esperar el plazo.
    netInfoMock.setConnected(true);

    expect(await screen.findByText('Completada')).toBeOnTheScreen();
    expect(
      screen.getByText('Tu transferencia ya se había registrado; este es su estado actual.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('transfer-1')).toBeOnTheScreen();

    const posts = fake.requestsTo('POST', '/transfers');
    expect(posts).toHaveLength(2);
    expect(posts[1]?.headers['idempotency-key']).toBe(posts[0]?.headers['idempotency-key']);
    expect(posts[1]?.body).toBe(posts[0]?.body);
    expect(server.byKey.size).toBe(1);
  });
});
