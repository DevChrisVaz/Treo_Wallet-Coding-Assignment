import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  authed,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';
import { signInAgain } from '../../helpers/scheduled.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;
let beneficiaryId: string;

beforeEach(async () => {
  t = await buildTestApp(harness, { now: '2026-10-14T18:00:00.000Z' });
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
});

async function schedule(scheduledFor: string, amount = '100.00', reference = '1') {
  const res = await postTransfer(t, ana, {
    fromAccountId: ana.principal.id,
    destination: { type: 'BENEFICIARY', beneficiaryId },
    amount,
    concept: 'Renta',
    reference,
    scheduledFor,
  });
  expect(res.status).toBe(201);
  t.clock.advance(1_000);
  return res.body.id as string;
}

const list = (owner: LedgerUser) => authed(t, owner.accessToken).get('/transfers/scheduled');

describe('TRF-33 consulta de las programadas', () => {
  it('TRF-33 sin programadas responde 200 con una lista vacía', async () => {
    const res = await list(ana);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });

  it('TRF-33 ordena por scheduledFor y luego por creación: 15 (la primera), 15 y 20', async () => {
    const day20 = await schedule('2026-10-20T15:00:00.000Z', '100.00', '1');
    const first15 = await schedule('2026-10-15T06:00:00.000Z', '200.00', '2');
    const second15 = await schedule('2026-10-15T06:00:00.000Z', '300.00', '3');

    const res = await list(ana);

    expect(res.status).toBe(200);
    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([
      first15,
      second15,
      day20,
    ]);
  });

  it('TRF-33 cada programada trae destino con nombre y últimos 4 dígitos, monto, concepto, referencia y fecha', async () => {
    const id = await schedule('2026-10-15T06:00:00.000Z', '1250.50', '1234567');
    const res = await list(ana);
    expect(res.body.items).toEqual([
      expect.objectContaining({
        id,
        status: 'SCHEDULED',
        kind: 'THIRD_PARTY',
        destination: {
          type: 'BENEFICIARY',
          accountId: null,
          beneficiaryId,
          displayName: 'Luis',
          clabeLast4: luis.principal.clabe.slice(-4),
        },
        amount: '1250.50',
        concept: 'Renta',
        reference: '1234567',
        scheduledFor: '2026-10-15T06:00:00.000Z',
        cancelledAt: null,
        completedAt: null,
        otp: null,
      }),
    ]);
  });

  it('TRF-33 una cancelada y una ejecutada dejan de aparecer', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const executed = await schedule('2026-10-15T06:00:00.000Z', '100.00', '1');
    const cancelled = await schedule('2026-10-16T06:00:00.000Z', '100.00', '2');
    const remaining = await schedule('2026-10-17T06:00:00.000Z', '100.00', '3');
    await authed(t, ana.accessToken).post(`/transfers/${cancelled}/cancel`);
    t.clock.set('2026-10-15T06:00:30.000Z');
    await t.container.scheduler.runner.runOnce();
    ana = await signInAgain(t, ana);

    const res = await list(ana);

    const ids = res.body.items.map((item: { id: string }) => item.id);
    expect(ids).toEqual([remaining]);
    expect(ids).not.toContain(executed);
  });

  it('TRF-33 no aparecen las que esperan su OTP, las vencidas, las fallidas ni las inmediatas', async () => {
    await fund(t, ana.principal.id, '1000.00');
    const scheduled = await schedule('2026-10-20T15:00:00.000Z', '100.00', '1');
    await schedule('2026-10-20T15:00:00.000Z', '15000.00', '2'); // PENDING_OTP
    await postTransfer(t, ana, {
      fromAccountId: ana.principal.id,
      destination: { type: 'BENEFICIARY', beneficiaryId },
      amount: '100.00',
      concept: 'Inmediata',
      reference: '3',
    });
    const res = await list(ana);
    expect(res.body.items.map((item: { id: string }) => item.id)).toEqual([scheduled]);

    t.clock.advance(5 * 60_000); // la de OTP vence
    ana = await signInAgain(t, ana);
    expect((await list(ana)).body.items).toHaveLength(1);
  });

  it('TRF-33 Luis no ve ninguna programada de Ana', async () => {
    await schedule('2026-10-15T06:00:00.000Z');
    const res = await list(luis);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [] });
  });

  it('TRF-33 la ruta no se confunde con GET /transfers/{transferId}', async () => {
    const id = await schedule('2026-10-15T06:00:00.000Z');
    const one = await authed(t, ana.accessToken).get(`/transfers/${id}`);
    expect(one.status).toBe(200);
    expect(one.body.id).toBe(id);
  });
});
