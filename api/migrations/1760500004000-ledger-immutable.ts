import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Asientos inmutables (TRF-23): además de que `wallet_app` solo tiene SELECT e INSERT, estos
 * triggers reutilizan `forbid_mutation()` (la de la auditoría) y rechazan UPDATE, DELETE y TRUNCATE
 * incluso al dueño de la tabla. Una corrección contable se hace con un contraasiento.
 */
export class LedgerImmutable1760500004000 implements MigrationInterface {
  name = 'LedgerImmutable1760500004000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TRIGGER tg_ledger_entries_immutable
        BEFORE UPDATE OR DELETE ON app.ledger_entries
        FOR EACH ROW EXECUTE FUNCTION app.forbid_mutation()
    `);
    await queryRunner.query(`
      CREATE TRIGGER tg_ledger_entries_no_truncate
        BEFORE TRUNCATE ON app.ledger_entries
        FOR EACH STATEMENT EXECUTE FUNCTION app.forbid_mutation()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER tg_ledger_entries_no_truncate ON app.ledger_entries`);
    await queryRunner.query(`DROP TRIGGER tg_ledger_entries_immutable ON app.ledger_entries`);
  }
}
