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

describe('TRF-05 peticiones simultáneas con la misma llave', () => {
  it('TRF-05 10 peticiones idénticas simultáneas: una transferencia, dos asientos y 10 respuestas con el mismo id', async () => {
    const t = await buildTestApp(harness);
    const ana = await ledgerUser(t, harness);
    const luis = await ledgerUser(t, harness);
    const beneficiaryId = await addBeneficiary(t, ana, {
      name: 'Luis',
      alias: 'Luis',
      clabe: luis.principal.clabe,
    });
    await fund(t, ana.principal.id, '1000.00');
    const key = randomUUID();
    const body = {
      fromAccountId: ana.principal.id,
      destination: { type: 'BENEFICIARY', beneficiaryId },
      amount: '100.00',
      concept: 'Doble clic',
      reference: '1',
    };

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => postTransfer(t, ana, body, key)),
    );

    expect(responses.map((res) => res.status).sort()).toEqual([
      200, 200, 200, 200, 200, 200, 200, 200, 200, 201,
    ]);
    const ids = new Set(responses.map((res) => res.body.id));
    expect(ids.size).toBe(1);
    expect(
      responses
        .filter((res) => res.status === 200)
        .every((res) => res.headers['idempotent-replayed'] === 'true'),
    ).toBe(true);
    const [transfer] = await harness.migrator.query(
      `SELECT count(*)::int AS n FROM app.transfers WHERE idempotency_key = $1`,
      [key],
    );
    expect(transfer.n).toBe(1);
    const [entries] = await harness.migrator.query(
      `SELECT count(*)::int AS n FROM app.ledger_entries WHERE transfer_id = $1`,
      [[...ids][0]],
    );
    expect(entries.n).toBe(2);
    expect(await balanceOf(harness, ana.principal.id)).toBe('900.00');
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });
});
