import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  authed,
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
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
  await fund(t, ana.principal.id, '20000.00');
});

async function getTransfer(user: LedgerUser, id: string) {
  const res = await authed(t, user.accessToken).get(`/transfers/${id}`);
  expectToMatchContract(res, 'getTransfer');
  return res;
}

const toLuis = (amount: string) => ({
  fromAccountId: ana.principal.id,
  destination: { type: 'BENEFICIARY', beneficiaryId },
  amount,
  concept: 'Enganche',
  reference: '42',
});

describe('TRF-26 consulta de una transferencia', () => {
  it('TRF-26 responde 200 con la misma transferencia que devolvió la creación', async () => {
    const created = await postTransfer(t, ana, toLuis('100.00'));
    const res = await getTransfer(ana, created.body.id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual(created.body);
  });

  it('TRF-19 una PENDING_OTP vencida se informa como EXPIRED y sin desafío', async () => {
    const created = await postTransfer(t, ana, toLuis('15000.00'));
    const before = await getTransfer(ana, created.body.id);
    expect(before.body).toMatchObject({ status: 'PENDING_OTP', otp: { attemptsRemaining: 3 } });
    t.clock.advance(5 * 60_000);
    const after = await getTransfer(ana, created.body.id);
    expect(after.body).toMatchObject({ status: 'EXPIRED', otp: null, completedAt: null });
  });

  it('TRF-26 la transferencia de otro usuario responde 404', async () => {
    const created = await postTransfer(t, ana, toLuis('100.00'));
    const res = await getTransfer(luis, created.body.id);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });
});

describe('TRF-26 comprobante', () => {
  it('TRF-26 Ana consulta una transferencia que envió: destino, monto, concepto, referencia, estado y fechas', async () => {
    const created = await postTransfer(t, ana, {
      ...toLuis('1250.5'),
      concept: 'Renta de octubre',
      reference: '0001234',
    });
    t.clock.advance(60_000);
    const res = await getTransfer(ana, created.body.id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: created.body.id,
      status: 'COMPLETED',
      kind: 'THIRD_PARTY',
      fromAccountId: ana.principal.id,
      destination: {
        type: 'BENEFICIARY',
        accountId: null,
        beneficiaryId,
        displayName: 'Luis',
        clabeLast4: luis.principal.clabe.slice(-4),
      },
      amount: '1250.50',
      concept: 'Renta de octubre',
      reference: '1234',
      requiresOtp: false,
      otp: null,
      rejectionReason: null,
      failureReason: null,
      createdAt: '2026-10-13T18:00:00.000Z',
      completedAt: '2026-10-13T18:00:00.000Z',
    });
    expect(JSON.stringify(res.body)).not.toContain(luis.principal.clabe);
  });

  it('TRF-26 el comprobante entre cuentas propias muestra la cuenta destino por su nombre', async () => {
    const created = await postTransfer(t, ana, {
      ...toLuis('500.00'),
      destination: { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id },
    });
    const res = await getTransfer(ana, created.body.id);
    expect(res.body).toMatchObject({
      kind: 'OWN',
      destination: {
        type: 'OWN_ACCOUNT',
        accountId: ana.ahorro.id,
        beneficiaryId: null,
        displayName: 'Ahorro',
        clabeLast4: ana.ahorro.clabe.slice(-4),
      },
    });
  });

  it('TRF-26 una transferencia rechazada también se consulta, con su motivo', async () => {
    const rejected = await postTransfer(t, ana, toLuis('25000.00'));
    const res = await getTransfer(ana, rejected.body.transferId);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'INSUFFICIENT_FUNDS',
      completedAt: null,
    });
  });
});

describe('TRF-26 transferencias que no son del usuario', () => {
  it('TRF-26 Ana consulta una transferencia enviada por Luis: 404', async () => {
    await fund(t, luis.principal.id, '1000.00');
    const sent = await postTransfer(t, luis, {
      fromAccountId: luis.principal.id,
      destination: { type: 'OWN_ACCOUNT', accountId: luis.ahorro.id },
      amount: '100.00',
      concept: 'Ahorro',
      reference: '1',
    });
    const res = await getTransfer(ana, sent.body.id);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('TRF-26 quien recibe una transferencia no la consulta como comprobante: 404', async () => {
    const created = await postTransfer(t, ana, toLuis('100.00'));
    expect((await getTransfer(luis, created.body.id)).status).toBe(404);
  });

  it('TRF-26 un fondeo, un id inexistente o mal formado responden 404', async () => {
    const [funding] = await harness.migrator.query(
      `SELECT id FROM app.transfers WHERE kind = 'FUNDING' AND to_account_id = $1`,
      [ana.principal.id],
    );
    expect((await getTransfer(ana, funding.id)).status).toBe(404);
    expect((await getTransfer(ana, '00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await getTransfer(ana, 'no-es-uuid')).status).toBe(404);
  });
});
