import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  balanceOf,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;
let beneficiaryId: string;

beforeEach(async () => {
  t = await buildTestApp(harness);
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
});

const toLuis = (amount: string) => ({
  fromAccountId: ana.principal.id,
  destination: { type: 'BENEFICIARY', beneficiaryId },
  amount,
  concept: 'Renta',
  reference: '1',
});

async function transfersWithKey(key: string): Promise<number> {
  const [{ n }] = await harness.migrator.query(
    'SELECT count(*)::int AS n FROM app.transfers WHERE idempotency_key = $1',
    [key],
  );
  return n;
}

describe('TRF-03 reintentos con la misma llave', () => {
  it('TRF-03 doble clic en Enviar: una transferencia, saldo descontado una vez y 200 con Idempotent-Replayed', async () => {
    await fund(t, ana.principal.id, '1000.00');
    const key = randomUUID();
    const first = await postTransfer(t, ana, toLuis('100.00'), key);
    const second = await postTransfer(t, ana, toLuis('100.00'), key);
    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body.id).toBe(first.body.id);
    expect(await transfersWithKey(key)).toBe(1);
    expect(await balanceOf(harness, ana.principal.id)).toBe('900.00');
  });

  it('TRF-03 pérdida de red: el reintento recibe COMPLETED con el mismo id sin descontar dos veces', async () => {
    await fund(t, ana.principal.id, '1000.00');
    const key = randomUUID();
    const lost = await postTransfer(t, ana, toLuis('250.00'), key);
    // La app no recibió `lost`; reintenta con la misma llave más tarde.
    t.clock.advance(5_000);
    const retry = await postTransfer(t, ana, toLuis('250.00'), key);
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ id: lost.body.id, status: 'COMPLETED' });
    expect(await balanceOf(harness, ana.principal.id)).toBe('750.00');
  });

  it('TRF-03 un rechazo reintentado después de fondear repite el mismo 422 y no ejecuta la transferencia', async () => {
    await fund(t, ana.principal.id, '100.00');
    const key = randomUUID();
    const rejected = await postTransfer(t, ana, toLuis('150.00'), key);
    await fund(t, ana.principal.id, '1000.00');
    const retry = await postTransfer(t, ana, toLuis('150.00'), key);
    expect(retry.status).toBe(422);
    expect(retry.body).toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
      transferId: rejected.body.transferId,
    });
    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect(await balanceOf(harness, ana.principal.id)).toBe('1100.00');
  });
});

describe('TRF-04 llave reutilizada con otro contenido', () => {
  it('TRF-04 la llave de una transferencia de 100.00 usada para 200.00 es 422 IDEMPOTENCY_KEY_REUSED', async () => {
    await fund(t, ana.principal.id, '1000.00');
    const key = randomUUID();
    await postTransfer(t, ana, toLuis('100.00'), key);
    const reused = await postTransfer(t, ana, toLuis('200.00'), key);
    expect(reused.status).toBe(422);
    expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await balanceOf(harness, ana.principal.id)).toBe('900.00');
  });

  it('TRF-04 "100.5" y luego "100.50" con la misma llave es el mismo contenido', async () => {
    await fund(t, ana.principal.id, '1000.00');
    const key = randomUUID();
    const first = await postTransfer(t, ana, toLuis('100.5'), key);
    const again = await postTransfer(t, ana, toLuis('100.50'), key);
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(first.body.id);
  });
});
