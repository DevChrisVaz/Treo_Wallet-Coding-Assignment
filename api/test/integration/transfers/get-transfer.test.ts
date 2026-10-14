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
