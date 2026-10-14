import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  balanceOf,
  fund,
  ledgerUser,
  postTransfer,
} from '../../helpers/ledger-api.js';
import { reconcile, RECONCILED } from '../../helpers/reconciliation.js';

const harness = useIntegrationHarness();
const ROUNDS = 25;

describe('TRF-24 transferencias cruzadas', () => {
  it('TRF-24 Ana → Luis y Luis → Ana al mismo tiempo, repetidamente: sin 40P01 y con saldos conciliados', async () => {
    const t = await buildTestApp(harness);
    const ana = await ledgerUser(t, harness);
    const luis = await ledgerUser(t, harness);
    const toLuis = await addBeneficiary(t, ana, {
      name: 'Luis',
      alias: 'Luis',
      clabe: luis.principal.clabe,
    });
    const toAna = await addBeneficiary(t, luis, {
      name: 'Ana',
      alias: 'Ana',
      clabe: ana.principal.clabe,
    });
    await fund(t, ana.principal.id, '10000.00');
    await fund(t, luis.principal.id, '10000.00');

    const requests = Array.from({ length: ROUNDS }, (_, i) => [
      postTransfer(
        t,
        ana,
        {
          fromAccountId: ana.principal.id,
          destination: { type: 'BENEFICIARY', beneficiaryId: toLuis },
          amount: '10.00',
          concept: 'Cruzada',
          reference: String(i),
        },
        randomUUID(),
      ),
      postTransfer(
        t,
        luis,
        {
          fromAccountId: luis.principal.id,
          destination: { type: 'BENEFICIARY', beneficiaryId: toAna },
          amount: '7.00',
          concept: 'Cruzada',
          reference: String(i),
        },
        randomUUID(),
      ),
    ]).flat();
    const responses = await Promise.all(requests);

    expect(responses.map((res) => res.status)).toEqual(Array(ROUNDS * 2).fill(201));
    expect(t.logs.text()).not.toContain('40P01');
    expect(await balanceOf(harness, ana.principal.id)).toBe('9925.00');
    expect(await balanceOf(harness, luis.principal.id)).toBe('10075.00');
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });
});
