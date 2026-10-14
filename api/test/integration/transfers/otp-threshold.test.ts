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
  await fund(t, ana.principal.id, '30000.00');
});

const toLuis = (amount: string) => ({
  fromAccountId: ana.principal.id,
  destination: { type: 'BENEFICIARY', beneficiaryId },
  amount,
  concept: 'Enganche',
  reference: '42',
});

async function balances(user: LedgerUser) {
  const res = await authed(t, user.accessToken).get('/accounts');
  expectToMatchContract(res, 'listAccounts');
  return Object.fromEntries(
    (res.body.accounts as { name: string; balance: string }[]).map((a) => [a.name, a.balance]),
  );
}

describe('TRF-14 umbral del OTP por HTTP', () => {
  it('TRF-14 15000.00 a un beneficiario responde 201 PENDING_OTP con attemptsRemaining 3 y el saldo no cambia', async () => {
    const res = await postTransfer(t, ana, toLuis('15000.00'));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'PENDING_OTP',
      requiresOtp: true,
      completedAt: null,
      otp: { channel: 'EMAIL', deliveryStatus: 'SENT', attemptsRemaining: 3, resendsRemaining: 3 },
    });
    expect(await balances(ana)).toEqual({ Principal: '30000.00', Ahorro: '0.00' });
    expect(await balances(luis)).toEqual({ Principal: '0.00', Ahorro: '0.00' });
  });

  it('ACC-13 una transferencia PENDING_OTP no aparta saldo: GET /accounts sigue mostrando 30000.00', async () => {
    await postTransfer(t, ana, toLuis('15000.00'));
    const res = await authed(t, ana.accessToken).get('/accounts');
    expect(res.body.accounts.find((a: { name: string }) => a.name === 'Principal').balance).toBe(
      '30000.00',
    );
    expect(res.body.dailyLimit.used).toBe('0.00');
  });

  it('TRF-14 exactamente 10000.00 se completa sin OTP', async () => {
    const res = await postTransfer(t, ana, toLuis('10000.00'));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'COMPLETED', requiresOtp: false, otp: null });
    expect(await balances(ana)).toEqual({ Principal: '20000.00', Ahorro: '0.00' });
  });

  it('TRF-14 10000.01 ya pide OTP', async () => {
    const res = await postTransfer(t, ana, toLuis('10000.01'));
    expect(res.body).toMatchObject({ status: 'PENDING_OTP', requiresOtp: true });
  });

  it('TRF-14 12000.00 de "Principal" a "Ahorro" también responde 201 PENDING_OTP', async () => {
    const res = await postTransfer(t, ana, {
      ...toLuis('12000.00'),
      destination: { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id },
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'PENDING_OTP', kind: 'OWN', requiresOtp: true });
    expect(await balances(ana)).toEqual({ Principal: '30000.00', Ahorro: '0.00' });
  });
});
