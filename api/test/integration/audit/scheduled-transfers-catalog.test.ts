import { describe, expect, it } from 'vitest';
import { AuditScheduledTransfers1760700001000 } from '../../../migrations/1760700001000-audit-scheduled-transfers.js';
import { isAuditAction } from '../../../src/modules/audit/domain/audit-event.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { sqlState } from '../../helpers/pg.js';

const harness = useIntegrationHarness();

const INSERT = `INSERT INTO app.audit_log (actor_type, actor_user_id, action, entity_type, entity_id, metadata)
                VALUES ('USER', gen_random_uuid(), $1, 'transfer', gen_random_uuid()::text,
                        '{"amount": "1000.00", "scheduledFor": "2026-10-15"}')`;

describe('AUD-08 eventos de las transferencias programadas en el catálogo', () => {
  it.each(['TRANSFER_SCHEDULED', 'TRANSFER_CANCELLED'])(
    'AUD-08 el dominio y la base aceptan %s',
    async (action) => {
      expect(isAuditAction(action)).toBe(true);
      await harness.app.query(INSERT.replaceAll('app.', ''), [action]);
    },
  );

  it('AUD-08 el catálogo conserva STATEMENT_EXPORTED de account-statements', async () => {
    expect(isAuditAction('STATEMENT_EXPORTED')).toBe(true);
    await harness.app.query(INSERT.replaceAll('app.', ''), ['STATEMENT_EXPORTED']);
  });

  it('AUD-08 una acción fuera del catálogo se rechaza por ck_audit_log_action', async () => {
    const error = await harness.app
      .query(INSERT.replaceAll('app.', ''), ['TRANSFER_RESCHEDULED'])
      .catch((e: { driverError?: { code?: string; constraint?: string } }) => e.driverError);
    expect(error).toMatchObject({ code: '23514', constraint: 'ck_audit_log_action' });
  });

  it('AUD-08 el down vuelve al catálogo anterior, con STATEMENT_EXPORTED, y conserva los eventos ya escritos', async () => {
    const runner = harness.migrator.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(INSERT, ['TRANSFER_SCHEDULED']);
      await new AuditScheduledTransfers1760700001000().down(runner);
      const [{ definition }] = await runner.query(
        `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
          WHERE conname = 'ck_audit_log_action'`,
      );
      expect(definition).not.toContain('TRANSFER_SCHEDULED');
      expect(definition).not.toContain('TRANSFER_CANCELLED');
      expect(definition).toContain('STATEMENT_EXPORTED');
      expect(definition).toContain('FUNDING_POSTED');
      await runner.query('SAVEPOINT nuevo');
      expect(await sqlState(runner.query(INSERT, ['TRANSFER_CANCELLED']))).toBe('23514');
      await runner.query('ROLLBACK TO SAVEPOINT nuevo');
      const [{ kept }] = await runner.query(
        `SELECT count(*)::int AS kept FROM app.audit_log WHERE action = 'TRANSFER_SCHEDULED'`,
      );
      expect(kept).toBe(1);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });
});
