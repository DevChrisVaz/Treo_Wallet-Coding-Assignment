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

describe('TRF-24 concurrencia sobre la misma cuenta', () => {
  it('TRF-24 100 transferencias simultáneas de 15.00 desde 1000.00: 66 COMPLETED, 34 REJECTED y saldo 10.00', async () => {
    const t = await buildTestApp(harness);
    const ana = await ledgerUser(t, harness);
    const luis = await ledgerUser(t, harness);
    const beneficiaryId = await addBeneficiary(t, ana, {
      name: 'Luis',
      alias: 'Luis',
      clabe: luis.principal.clabe,
    });
    await fund(t, ana.principal.id, '1000.00');

    const responses = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        postTransfer(
          t,
          ana,
          {
            fromAccountId: ana.principal.id,
            destination: { type: 'BENEFICIARY', beneficiaryId },
            amount: '15.00',
            concept: 'Carrera',
            reference: String(i),
          },
          randomUUID(),
        ),
      ),
    );

    const statuses = responses.map((res) => res.status).sort();
    expect(statuses.filter((status) => status === 201)).toHaveLength(66);
    expect(statuses.filter((status) => status === 422)).toHaveLength(34);
    expect(
      responses
        .filter((res) => res.status === 422)
        .every((res) => res.body.code === 'INSUFFICIENT_FUNDS'),
    ).toBe(true);

    const rows: { status: string; n: number }[] = await harness.migrator.query(
      `SELECT status, count(*)::int AS n FROM app.transfers
        WHERE user_id = $1 GROUP BY status ORDER BY status`,
      [ana.userId],
    );
    expect(rows).toEqual([
      { status: 'COMPLETED', n: 66 },
      { status: 'REJECTED', n: 34 },
    ]);
    expect(await balanceOf(harness, ana.principal.id)).toBe('10.00');
    expect(await balanceOf(harness, luis.principal.id)).toBe('990.00');
    const [{ sum }] = await harness.migrator.query(
      'SELECT COALESCE(sum(amount_cents), 0)::text AS sum FROM app.ledger_entries',
    );
    expect(sum).toBe('0');
    const [usage] = await harness.migrator.query(
      'SELECT used_cents FROM app.daily_transfer_usage WHERE user_id = $1',
      [ana.userId],
    );
    expect(usage.used_cents).toBe('99000');
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });
});
