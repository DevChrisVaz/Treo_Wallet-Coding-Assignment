import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PgAuditWriter } from '../../../src/modules/audit/infrastructure/pg-audit-writer.js';
import { runWithRequestContext } from '../../../src/platform/context/request-context.js';
import {
  queryIn,
  TypeormTransactionRunner,
} from '../../../src/platform/persistence/transaction.js';
import { auditEvents, leakedValues } from '../../helpers/audit.js';
import { FakeClock } from '../../helpers/fake-clock.js';
import { useIntegrationHarness } from '../../helpers/harness.js';

const harness = useIntegrationHarness();
const clock = new FakeClock();

const person = {
  email: 'ana.gomez@example.com',
  curp: 'GOMC900101HDFNLR09',
  rfc: 'GOMC900101AB1',
  phone: '+525512345678',
};

async function registerUserWithAudit(context: { ip: string }) {
  const runner = new TypeormTransactionRunner(harness.app);
  const audit = new PgAuditWriter(harness.app, clock);
  const id = randomUUID();
  await runWithRequestContext(
    { requestId: 'req-atomic', ip: context.ip, userAgent: 'vitest' },
    () =>
      runner.run(async (tx) => {
        await queryIn(
          tx,
          `INSERT INTO users (id, email, password_hash, full_name, curp, rfc, phone, first_names, paternal_surname, birth_date, birth_state)
         VALUES ($1, $2, 'hash', 'Ana Gómez', $3, $4, $5, 'Ana', 'Gómez', '1990-01-01', 'DF')`,
          [id, person.email, person.curp, person.rfc, person.phone],
        );
        await audit.record(tx, {
          action: 'USER_REGISTERED',
          actor: { type: 'USER', userId: id },
          entity: { type: 'user', id },
        });
      }),
  );
  return id;
}

async function userCount(): Promise<number> {
  const [row] = await harness.migrator.query('SELECT count(*)::int AS n FROM app.users');
  return row.n;
}

describe('AUD-03 escritura atómica con la operación', () => {
  it('AUD-03 si la escritura del evento falla en la base, el cambio de negocio se revierte', async () => {
    // Una IP que PostgreSQL no acepta como inet hace fallar el INSERT de auditoría (22P02).
    await expect(registerUserWithAudit({ ip: 'no-es-una-ip' })).rejects.toMatchObject({
      driverError: { code: '22P02' },
    });
    expect(await userCount()).toBe(0);
    expect(await auditEvents(harness.migrator)).toEqual([]);
  });

  it('AUD-03 si la escritura funciona, el cambio y el evento se confirman juntos', async () => {
    const id = await registerUserWithAudit({ ip: '203.0.113.7' });
    expect(await userCount()).toBe(1);
    expect(await auditEvents(harness.migrator)).toMatchObject([
      { action: 'USER_REGISTERED', actor_user_id: id, entity_id: id },
    ]);
  });
});

describe('AUD-02 sin datos personales en la auditoría', () => {
  it('AUD-02 el evento de un registro solo lleva ids', async () => {
    const id = await registerUserWithAudit({ ip: '203.0.113.7' });
    const rows = await auditEvents(harness.migrator);
    expect(rows[0]?.entity_id).toBe(id);
    expect(leakedValues(rows, Object.values(person))).toEqual([]);
  });
});

describe('AUD-06 eventos sin sujeto existente', () => {
  it('AUD-06 un login fallido de un email desconocido queda como LOGIN_FAILED anónimo', async () => {
    const audit = new PgAuditWriter(harness.app, clock);
    await audit.recordStandalone({
      action: 'LOGIN_FAILED',
      actor: { type: 'ANONYMOUS' },
      metadata: { reason: 'INVALID_CREDENTIALS' },
    });
    expect(await auditEvents(harness.migrator)).toMatchObject([
      { action: 'LOGIN_FAILED', actor_type: 'ANONYMOUS', actor_user_id: null, entity_id: null },
    ]);
  });
});
