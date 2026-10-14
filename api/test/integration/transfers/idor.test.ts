import { beforeEach, describe, expect, it } from 'vitest';
import { TREASURY_ACCOUNT_ID } from '../../../migrations/1760400002000-accounts.js';
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

beforeEach(async () => {
  t = await buildTestApp(harness);
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  await fund(t, ana.principal.id, '1000.00');
  await fund(t, luis.principal.id, '1000.00');
});

async function balances() {
  return Promise.all(
    [ana.principal.id, ana.ahorro.id, luis.principal.id, luis.ahorro.id].map((id) =>
      balanceOf(harness, id),
    ),
  );
}

describe('TRF-06 propiedad de cuentas y beneficiarios', () => {
  it('TRF-06 Ana con fromAccountId de una cuenta de Luis recibe 404 y el saldo de Luis no cambia', async () => {
    const before = await balances();
    const res = await postTransfer(t, ana, {
      fromAccountId: luis.principal.id,
      destination: { type: 'OWN_ACCOUNT', accountId: ana.principal.id },
      amount: '500.00',
      concept: 'Robo',
      reference: '1',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(await balances()).toEqual(before);
  });

  it('TRF-06 OWN_ACCOUNT con una cuenta de Luis responde 404', async () => {
    const before = await balances();
    const res = await postTransfer(t, ana, {
      fromAccountId: ana.principal.id,
      destination: { type: 'OWN_ACCOUNT', accountId: luis.principal.id },
      amount: '10.00',
      concept: 'Pago',
      reference: '1',
    });
    expect(res.status).toBe(404);
    expect(await balances()).toEqual(before);
  });

  it('TRF-06 el beneficiario registrado por Luis no sirve a Ana: 404', async () => {
    const carla = await ledgerUser(t, harness);
    const luisBeneficiary = await addBeneficiary(t, luis, {
      name: 'Carla',
      alias: 'Carla',
      clabe: carla.principal.clabe,
    });
    const before = await balances();
    const res = await postTransfer(t, ana, {
      fromAccountId: ana.principal.id,
      destination: { type: 'BENEFICIARY', beneficiaryId: luisBeneficiary },
      amount: '10.00',
      concept: 'Pago',
      reference: '1',
    });
    expect(res.status).toBe(404);
    expect(await balances()).toEqual(before);
    expect(await balanceOf(harness, carla.principal.id)).toBe('0.00');
  });

  it('ACC-16 la Tesorería como destino OWN_ACCOUNT responde 404', async () => {
    const res = await postTransfer(t, ana, {
      fromAccountId: ana.principal.id,
      destination: { type: 'OWN_ACCOUNT', accountId: TREASURY_ACCOUNT_ID },
      amount: '10.00',
      concept: 'Pago',
      reference: '1',
    });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    expect(await balanceOf(harness, ana.principal.id)).toBe('1000.00');
  });
});
