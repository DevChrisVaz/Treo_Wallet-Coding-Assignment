import { describe, expect, it } from 'vitest';
import { AuditStatementExported1760600000000 } from '../../../migrations/1760600000000-audit-statement-exported.js';
import { isAuditAction } from '../../../src/modules/audit/domain/audit-event.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { sqlState } from '../../helpers/pg.js';

const harness = useIntegrationHarness();

const INSERT = `INSERT INTO app.audit_log (actor_type, actor_user_id, action, entity_type, entity_id, metadata)
                VALUES ('USER', gen_random_uuid(), $1, 'ACCOUNT', gen_random_uuid()::text, '{"period": "2026-09"}')`;

describe('AUD-07 STATEMENT_EXPORTED en el catálogo', () => {
  it('AUD-07 el dominio y la base aceptan STATEMENT_EXPORTED', async () => {
    expect(isAuditAction('STATEMENT_EXPORTED')).toBe(true);
    await harness.app.query(INSERT.replaceAll('app.', ''), ['STATEMENT_EXPORTED']);
  });

  it('AUD-07 el down restaura el catálogo anterior y conserva los eventos ya escritos', async () => {
    const runner = harness.migrator.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(INSERT, ['STATEMENT_EXPORTED']);
      await new AuditStatementExported1760600000000().down(runner);
      const [{ definition }] = await runner.query(
        `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
          WHERE conname = 'ck_audit_log_action'`,
      );
      expect(definition).not.toContain('STATEMENT_EXPORTED');
      expect(definition).toContain('FUNDING_POSTED');
      await runner.query('SAVEPOINT nuevo');
      expect(await sqlState(runner.query(INSERT, ['STATEMENT_EXPORTED']))).toBe('23514');
      await runner.query('ROLLBACK TO SAVEPOINT nuevo');
      const [{ kept }] = await runner.query(
        `SELECT count(*)::int AS kept FROM app.audit_log WHERE action = 'STATEMENT_EXPORTED'`,
      );
      expect(kept).toBe(1);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });
});
