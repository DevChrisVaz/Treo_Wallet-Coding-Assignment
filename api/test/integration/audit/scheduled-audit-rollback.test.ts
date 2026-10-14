import { beforeEach, describe, expect, it } from 'vitest';
import type { AuditWriter } from '../../../src/modules/audit/application/audit-writer.js';
import { PgAuditWriter } from '../../../src/modules/audit/infrastructure/pg-audit-writer.js';
import { auditEvents } from '../../helpers/audit.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  authed,
  confirmTransfer,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let beneficiaryId: string;
/** Acción de auditoría que se hace fallar (`null`: ninguna). */
let failAction: string | null;

beforeEach(async () => {
  failAction = null;
  const real = new PgAuditWriter(harness.app, { now: () => t.clock.now() });
  const audit: AuditWriter = {
    record: async (tx, event) => {
      if (event.action === failAction) throw new Error('falla forzada de auditoría');
      return real.record(tx, event);
    },
    recordStandalone: (event) => real.recordStandalone(event),
  };
  t = await buildTestApp(harness, { now: '2026-10-14T18:00:00.000Z', overrides: { audit } });
  ana = await ledgerUser(t, harness);
  const luis = await ledgerUser(t, harness);
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
  await fund(t, ana.principal.id, '20000.00');
});

const toLuis = (amount: string) => ({
  fromAccountId: ana.principal.id,
  destination: { type: 'BENEFICIARY', beneficiaryId },
  amount,
  concept: 'Renta',
  reference: '1',
  scheduledFor: '2026-10-20',
});

async function transferEvents(): Promise<string[]> {
  return (await auditEvents(harness.migrator))
    .filter((event) => event.entity_type === 'transfer')
    .map((event) => event.action);
}

async function transfersOfAna(): Promise<number> {
  const [{ n }] = await harness.migrator.query(
    `SELECT count(*)::int AS n FROM app.transfers WHERE user_id = $1 AND kind <> 'FUNDING'`,
    [ana.userId],
  );
  return n;
}

async function rowOf(id: string) {
  const [row] = await harness.migrator.query(
    `SELECT t.status, t.cancelled_at,
            (SELECT c.attempts FROM app.one_time_codes c WHERE c.subject_id = t.id) AS attempts,
            (SELECT c.consumed_at FROM app.one_time_codes c WHERE c.subject_id = t.id) AS consumed_at
       FROM app.transfers t WHERE t.id = $1`,
    [id],
  );
  return row;
}

describe('TRF-36 y AUD-08 la auditoría falla en una operación sobre una programada', () => {
  it.each(['TRANSFER_CREATED', 'TRANSFER_SCHEDULED'])(
    'TRF-36 si falla %s al programar, no queda la transferencia ni su auditoría y la llave sigue libre',
    async (action) => {
      failAction = action;
      const key = crypto.randomUUID();
      const eventsBefore = (await transferEvents()).length;

      const failed = await postTransfer(t, ana, toLuis('1000.00'), key);

      expect(failed.status).toBe(500);
      expect(await transfersOfAna()).toBe(0);
      expect(await transferEvents()).toHaveLength(eventsBefore);

      failAction = null;
      const retry = await postTransfer(t, ana, toLuis('1000.00'), key);
      expect(retry.status).toBe(201);
      expect(retry.headers['idempotent-replayed']).toBeUndefined();
      expect(retry.body.status).toBe('SCHEDULED');
    },
  );

  it('TRF-36 si falla TRANSFER_SCHEDULED al confirmar con OTP, sigue PENDING_OTP con el código sin consumir', async () => {
    const created = await postTransfer(t, ana, toLuis('15000.00'));
    expect(created.body.status).toBe('PENDING_OTP');
    const id = created.body.id as string;
    const code = t.mailer.lastCode(ana.person.email);
    const eventsBefore = await transferEvents();
    failAction = 'TRANSFER_SCHEDULED';

    const failed = await confirmTransfer(t, ana, id, { otp: code });

    expect(failed.status).toBe(500);
    expect(await rowOf(id)).toMatchObject({
      status: 'PENDING_OTP',
      attempts: 0,
      consumed_at: null,
    });
    expect(await transferEvents()).toEqual(eventsBefore);

    failAction = null;
    const retry = await confirmTransfer(t, ana, id, { otp: code });
    expect(retry.status).toBe(200);
    expect(retry.body.status).toBe('SCHEDULED');
  });

  it('TRF-36 si falla TRANSFER_CANCELLED al cancelar, la transferencia sigue SCHEDULED sin cancelledAt', async () => {
    const created = await postTransfer(t, ana, toLuis('1000.00'));
    expect(created.body.status).toBe('SCHEDULED');
    const id = created.body.id as string;
    const eventsBefore = await transferEvents();
    failAction = 'TRANSFER_CANCELLED';

    const failed = await authed(t, ana.accessToken).post(`/transfers/${id}/cancel`);

    expect(failed.status).toBe(500);
    expect(await rowOf(id)).toMatchObject({ status: 'SCHEDULED', cancelled_at: null });
    expect(await transferEvents()).toEqual(eventsBefore);

    failAction = null;
    const retry = await authed(t, ana.accessToken).post(`/transfers/${id}/cancel`);
    expect(retry.status).toBe(200);
    expect(retry.body.status).toBe('CANCELLED');
  });
});
