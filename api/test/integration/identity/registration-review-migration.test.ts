import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { RegistrationReview1761000000000 } from '../../../migrations/1761000000000-registration-review.js';
import { isAuditAction } from '../../../src/modules/audit/domain/audit-event.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { sqlState } from '../../helpers/pg.js';

const harness = useIntegrationHarness();

const INSERT_EVENT = `INSERT INTO app.audit_log (actor_type, actor_user_id, action, entity_type, entity_id, metadata)
                      VALUES ('USER', gen_random_uuid(), $1, 'user', gen_random_uuid()::text,
                              '{"curpTaken": true, "rfcTaken": false, "phoneTaken": false}')`;

const INSERT_USER = `INSERT INTO app.users (id, email, password_hash, full_name, curp, rfc, phone,
                                            first_names, paternal_surname, birth_date, birth_state,
                                            identity_conflict)
                     VALUES ($1, $2, 'argon2-hash', 'Ana Gómez', 'GOMA900101MDFRRN09',
                             'GOMA900101AB1', '+525512345678', 'Ana', 'Gómez', '1990-01-01', 'DF', $3)`;

describe('IDN-03 AUD-01 migración de la revisión de registros', () => {
  it('AUD-01 el dominio y la base aceptan REGISTRATION_IN_REVIEW', async () => {
    expect(isAuditAction('REGISTRATION_IN_REVIEW')).toBe(true);
    await harness.app.query(INSERT_EVENT.replaceAll('app.', ''), ['REGISTRATION_IN_REVIEW']);
  });

  it('AUD-01 el catálogo conserva los eventos de las transferencias programadas', async () => {
    await harness.app.query(INSERT_EVENT.replaceAll('app.', ''), ['TRANSFER_SCHEDULED']);
    await harness.app.query(INSERT_EVENT.replaceAll('app.', ''), ['TRANSFER_CANCELLED']);
  });

  it('IDN-03 el down se niega mientras exista un usuario en revisión', async () => {
    const runner = harness.migrator.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(INSERT_USER, [randomUUID(), 'revision@example.com', true]);
      await expect(new RegistrationReview1761000000000().down(runner)).rejects.toThrow(
        'Hay 1 usuarios en revisión',
      );
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('IDN-03 el down vuelve a las constraints únicas y AUD-01 al catálogo anterior, con los eventos ya escritos', async () => {
    const runner = harness.migrator.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await runner.query(INSERT_EVENT, ['REGISTRATION_IN_REVIEW']);
      await new RegistrationReview1761000000000().down(runner);
      const constraints = (await runner.query(
        `SELECT conname FROM pg_constraint
          WHERE conname IN ('uq_users_curp', 'uq_users_rfc', 'uq_users_phone') AND contype = 'u'`,
      )) as { conname: string }[];
      expect(constraints.map((c) => c.conname).sort()).toEqual([
        'uq_users_curp',
        'uq_users_phone',
        'uq_users_rfc',
      ]);
      const [{ definition }] = await runner.query(
        `SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
          WHERE conname = 'ck_audit_log_action'`,
      );
      expect(definition).not.toContain('REGISTRATION_IN_REVIEW');
      expect(definition).toContain('TRANSFER_SCHEDULED');
      await runner.query('SAVEPOINT nuevo');
      expect(await sqlState(runner.query(INSERT_EVENT, ['REGISTRATION_IN_REVIEW']))).toBe('23514');
      await runner.query('ROLLBACK TO SAVEPOINT nuevo');
      const [{ kept }] = await runner.query(
        `SELECT count(*)::int AS kept FROM app.audit_log WHERE action = 'REGISTRATION_IN_REVIEW'`,
      );
      expect(kept).toBe(1);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });
});
