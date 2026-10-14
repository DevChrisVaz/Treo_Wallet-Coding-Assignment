import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { ledgerUser, postTransfer, type LedgerUser } from '../../helpers/ledger-api.js';
import { insertScheduledTransfers, waitForLockWaiters } from '../../helpers/scheduled.js';

const harness = useIntegrationHarness();
const ROUNDS = 3;

/**
 * Dos programaciones con llaves distintas que llegan juntas al conteo: una conexión aparte retiene
 * la fila del usuario con `FOR UPDATE`, así que ambas esperan en el reclamo de la llave (la llave
 * foránea `transfers.user_id` pide `FOR KEY SHARE` sobre esa fila) y se liberan al mismo tiempo.
 */
async function race(t: TestApp, owner: LedgerUser) {
  const holder = harness.migrator.createQueryRunner();
  await holder.connect();
  try {
    await holder.startTransaction();
    await holder.query(`SELECT 1 FROM app.users WHERE id = $1 FOR UPDATE`, [owner.userId]);
    const racing = Promise.all(
      ['A', 'B'].map((reference) =>
        postTransfer(
          t,
          owner,
          {
            fromAccountId: owner.principal.id,
            destination: { type: 'OWN_ACCOUNT', accountId: owner.ahorro.id },
            amount: '100.00',
            concept: `Carrera ${reference}`,
            reference: '7',
            scheduledFor: '2026-10-20',
          },
          randomUUID(),
        ),
      ),
    );
    // Lanza si las dos peticiones no llegan juntas a esperar la fila retenida.
    await waitForLockWaiters(harness.migrator, 2);
    await holder.commitTransaction();
    return await racing;
  } finally {
    if (holder.isTransactionActive) await holder.rollbackTransaction();
    await holder.release();
  }
}

describe('TRF-29 tope de programadas ante concurrencia', () => {
  it('TRF-29 con 19 activas, dos programaciones simultáneas con llaves distintas: exactamente una 201 y otra 422', async () => {
    const t = await buildTestApp(harness, { now: '2026-10-14T18:00:00.000Z' });
    for (let round = 0; round < ROUNDS; round += 1) {
      const owner = await ledgerUser(t, harness);
      await insertScheduledTransfers(harness.migrator, owner, 19);

      const responses = await race(t, owner);

      const statuses = responses.map((res) => res.status).sort();
      expect(statuses, `ronda ${round + 1}`).toEqual([201, 422]);
      expect(responses.find((res) => res.status === 422)?.body.code).toBe(
        'SCHEDULED_LIMIT_REACHED',
      );
      const [{ active }] = await harness.migrator.query(
        `SELECT count(*)::int AS active FROM app.transfers
          WHERE user_id = $1 AND status = 'SCHEDULED'`,
        [owner.userId],
      );
      expect(active, `ronda ${round + 1}`).toBe(20);
    }
    expect(t.logs.text()).not.toContain('40P01');
  });
});
