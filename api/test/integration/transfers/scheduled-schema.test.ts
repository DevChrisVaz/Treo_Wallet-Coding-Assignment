import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ScheduledTransfers1760700000000 } from '../../../migrations/1760700000000-scheduled-transfers.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { insertUserWithAccounts, type FixtureUser } from '../../helpers/ledger-fixtures.js';

const harness = useIntegrationHarness();

/** Transferencia OWN sin asientos con el estado, la fecha y la cancelación dados (rol de ejecución). */
async function insertTransfer(
  user: FixtureUser,
  values: { status: string; scheduledFor: string | null; cancelledAt: Date | null },
) {
  const id = randomUUID();
  await harness.app.query(
    `INSERT INTO transfers (id, user_id, idempotency_key, request_fingerprint, kind, status,
                            from_account_id, to_account_id, amount_cents, concept, reference,
                            requires_otp, created_at, scheduled_for, cancelled_at)
     VALUES ($1, $2, $3, repeat('d', 64), 'OWN', $4, $5, $6, 1000, 'Programada', 1, false, now(),
             $7::date, $8)`,
    [
      id,
      user.userId,
      randomUUID(),
      values.status,
      user.principalId,
      user.ahorroId,
      values.scheduledFor,
      values.cancelledAt,
    ],
  );
  return id;
}

async function violation(promise: Promise<unknown>) {
  const error = (await promise.then(
    () => undefined,
    (e: unknown) => e,
  )) as { driverError?: { code?: string; constraint?: string } } | undefined;
  return error?.driverError;
}

describe('TRF-34 estados de las programadas en la base', () => {
  it('TRF-34 acepta una SCHEDULED con fecha y una CANCELLED con fecha y momento de cancelación', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    await insertTransfer(ana, {
      status: 'SCHEDULED',
      scheduledFor: '2026-10-15',
      cancelledAt: null,
    });
    await insertTransfer(ana, {
      status: 'CANCELLED',
      scheduledFor: '2026-10-15',
      cancelledAt: new Date('2026-10-14T18:00:00Z'),
    });
    const rows = await harness.migrator.query(
      `SELECT status, scheduled_for::text AS scheduled_for FROM app.transfers ORDER BY status`,
    );
    expect(rows).toEqual([
      { status: 'CANCELLED', scheduled_for: '2026-10-15' },
      { status: 'SCHEDULED', scheduled_for: '2026-10-15' },
    ]);
  });

  it('TRF-34 una SCHEDULED sin scheduled_for se rechaza por ck_transfers_scheduled_has_date', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    expect(
      await violation(
        insertTransfer(ana, { status: 'SCHEDULED', scheduledFor: null, cancelledAt: null }),
      ),
    ).toMatchObject({ code: '23514', constraint: 'ck_transfers_scheduled_has_date' });
  });

  it('TRF-34 una CANCELLED sin scheduled_for se rechaza por ck_transfers_scheduled_has_date', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    expect(
      await violation(
        insertTransfer(ana, { status: 'CANCELLED', scheduledFor: null, cancelledAt: new Date() }),
      ),
    ).toMatchObject({ code: '23514', constraint: 'ck_transfers_scheduled_has_date' });
  });

  it('TRF-34 una fecha de cancelación fuera de CANCELLED se rechaza por ck_transfers_cancelled_at_by_status', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    expect(
      await violation(
        insertTransfer(ana, {
          status: 'SCHEDULED',
          scheduledFor: '2026-10-15',
          cancelledAt: new Date(),
        }),
      ),
    ).toMatchObject({ code: '23514', constraint: 'ck_transfers_cancelled_at_by_status' });
  });

  it('TRF-34 una CANCELLED sin fecha de cancelación se rechaza por ck_transfers_cancelled_at_by_status', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    expect(
      await violation(
        insertTransfer(ana, { status: 'CANCELLED', scheduledFor: '2026-10-15', cancelledAt: null }),
      ),
    ).toMatchObject({ code: '23514', constraint: 'ck_transfers_cancelled_at_by_status' });
  });

  it('TRF-34 un estado fuera del catálogo sigue rechazándose por ck_transfers_status', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    expect(
      await violation(
        insertTransfer(ana, { status: 'PAUSED', scheduledFor: '2026-10-15', cancelledAt: null }),
      ),
    ).toMatchObject({ code: '23514', constraint: 'ck_transfers_status' });
  });

  it('TRF-30 los índices parciales del ejecutor y de la lista solo cubren las SCHEDULED', async () => {
    const rows: { indexname: string; indexdef: string }[] = await harness.migrator.query(
      `SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname = 'app' AND indexname IN ('ix_transfers_scheduled_due', 'ix_transfers_user_scheduled')
        ORDER BY indexname`,
    );
    expect(rows.map((row) => row.indexname)).toEqual([
      'ix_transfers_scheduled_due',
      'ix_transfers_user_scheduled',
    ]);
    const [due, user] = rows;
    expect(due?.indexdef).toContain('(scheduled_for, created_at, id)');
    expect(user?.indexdef).toContain('(user_id, scheduled_for, created_at)');
    for (const row of rows) expect(row.indexdef).toContain(`WHERE (status = 'SCHEDULED'::text)`);
  });
});

describe('PLT-15 down protegido de la migración de programadas', () => {
  /** Corre el `down` en una transacción del dueño que siempre se revierte. */
  async function downInTransaction(
    before?: (run: (sql: string) => Promise<unknown>) => Promise<void>,
  ) {
    const runner = harness.migrator.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await before?.((sql) => runner.query(sql));
      await new ScheduledTransfers1760700000000().down(runner);
      const columns: { column_name: string }[] = await runner.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'app' AND table_name = 'transfers'
            AND column_name IN ('scheduled_for', 'cancelled_at')`,
      );
      const [{ definition }] = await runner.query(
        `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
          WHERE conname = 'ck_transfers_status'`,
      );
      return { columns, definition: definition as string };
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  }

  it('PLT-15 sin programadas, el down quita columnas, índices y estados nuevos', async () => {
    const ana = await insertUserWithAccounts(harness.migrator);
    await insertTransfer(ana, { status: 'PENDING_OTP', scheduledFor: null, cancelledAt: null });
    const result = await downInTransaction();
    expect(result.columns).toEqual([]);
    expect(result.definition).not.toContain('SCHEDULED');
    expect(result.definition).not.toContain('CANCELLED');
    expect(result.definition).toContain('PENDING_OTP');
  });

  it.each([
    ['una SCHEDULED', { status: 'SCHEDULED', scheduledFor: '2026-10-15', cancelledAt: null }],
    [
      'una CANCELLED',
      {
        status: 'CANCELLED',
        scheduledFor: '2026-10-15',
        cancelledAt: new Date('2026-10-14T18:00:00Z'),
      },
    ],
    [
      'una programada pendiente de OTP',
      { status: 'PENDING_OTP', scheduledFor: '2026-10-15', cancelledAt: null },
    ],
  ])(
    'PLT-15 con %s, el down se niega con un mensaje claro y no cambia nada',
    async (_case, values) => {
      const ana = await insertUserWithAccounts(harness.migrator);
      await insertTransfer(ana, values);
      await expect(downInTransaction()).rejects.toThrow(/transferencias programadas/);
      const [{ n }] = await harness.migrator.query(
        `SELECT count(*)::int AS n FROM app.transfers WHERE scheduled_for IS NOT NULL`,
      );
      expect(n).toBe(1);
    },
  );
});
