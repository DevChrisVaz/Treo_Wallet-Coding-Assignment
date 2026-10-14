import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { addBeneficiary, fund, ledgerUser, postTransfer } from '../../helpers/ledger-api.js';
import { reconcile, RECONCILED } from '../../helpers/reconciliation.js';

const harness = useIntegrationHarness();

describe('TRF-13 límite diario ante concurrencia', () => {
  it('TRF-13 con 40000.00 usados, 8000.00 desde "Principal" y desde "Ahorro" a la vez: exactamente una se completa y el uso queda en 48000.00', async () => {
    const t = await buildTestApp(harness); // 12:00 de CDMX del 2026-10-13
    const ana = await ledgerUser(t, harness);
    const luis = await ledgerUser(t, harness);
    const beneficiaryId = await addBeneficiary(t, ana, {
      name: 'Luis',
      alias: 'Luis',
      clabe: luis.principal.clabe,
    });
    await fund(t, ana.principal.id, '10000.00');
    await fund(t, ana.ahorro.id, '10000.00');
    await harness.migrator.query(
      `INSERT INTO app.daily_transfer_usage (user_id, day, used_cents, limit_cents)
       VALUES ($1, '2026-10-13', 4000000, 5000000)`,
      [ana.userId],
    );

    // Las dos peticiones esperan juntas la fila contador, retenida por otra transacción.
    const holder = harness.migrator.createQueryRunner();
    await holder.connect();
    let responses;
    try {
      await holder.startTransaction();
      await holder.query(`SELECT 1 FROM app.daily_transfer_usage WHERE user_id = $1 FOR UPDATE`, [
        ana.userId,
      ]);
      const racing = Promise.all(
        [ana.principal.id, ana.ahorro.id].map((fromAccountId) =>
          postTransfer(
            t,
            ana,
            {
              fromAccountId,
              destination: { type: 'BENEFICIARY', beneficiaryId },
              amount: '8000.00',
              concept: 'Carrera',
              reference: '1',
            },
            randomUUID(),
          ),
        ),
      );
      for (let i = 0; i < 150; i++) {
        const [{ n }] = await harness.migrator.query(
          'SELECT count(*)::int AS n FROM pg_locks WHERE NOT granted',
        );
        if (n >= 2) break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      await holder.commitTransaction();
      responses = await racing;
    } finally {
      if (holder.isTransactionActive) await holder.rollbackTransaction();
      await holder.release();
    }

    const completed = responses.filter((res) => res.status === 201);
    const rejected = responses.filter((res) => res.status === 422);
    expect(completed).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.body).toMatchObject({
      code: 'DAILY_LIMIT_EXCEEDED',
      remaining: '2000.00',
      transferId: expect.any(String),
    });
    const [row] = await harness.migrator.query(
      'SELECT status, rejection_reason FROM app.transfers WHERE id = $1',
      [rejected[0]?.body.transferId],
    );
    expect(row).toEqual({ status: 'REJECTED', rejection_reason: 'DAILY_LIMIT_EXCEEDED' });
    const [usage] = await harness.migrator.query(
      'SELECT used_cents FROM app.daily_transfer_usage WHERE user_id = $1',
      [ana.userId],
    );
    expect(usage.used_cents).toBe('4800000');
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });
});
