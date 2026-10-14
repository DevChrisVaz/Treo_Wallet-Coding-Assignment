import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Partida doble garantizada por la base (TRF-21), con dos constraint triggers diferidos al COMMIT:
 * - `tg_ledger_entries_zero_sum`: la transferencia de cada asiento tiene exactamente 2 asientos que
 *   suman 0 y está `COMPLETED`;
 * - `tg_transfers_completed_has_entries`: una transferencia que queda `COMPLETED` tiene sus 2
 *   asientos que suman 0.
 * Fallan con `check_violation` y el nombre del trigger como constraint, para que el traductor de
 * errores lo reconozca por nombre (un 500 con alerta: indicaría un error de código).
 */
export class LedgerZeroSum1760500003000 implements MigrationInterface {
  name = 'LedgerZeroSum1760500003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION app.assert_transfer_balanced(target uuid, constraint_name text)
      RETURNS void LANGUAGE plpgsql AS $$
      DECLARE
        entries integer;
        total   bigint;
        state   text;
      BEGIN
        SELECT count(*), COALESCE(sum(amount_cents), 0) INTO entries, total
          FROM app.ledger_entries WHERE transfer_id = target;
        SELECT status INTO state FROM app.transfers WHERE id = target;
        IF entries <> 2 OR total <> 0 OR state IS DISTINCT FROM 'COMPLETED' THEN
          RAISE EXCEPTION 'La transferencia % no cuadra: % asientos, suma %, estado %',
                          target, entries, total, state
            USING ERRCODE = 'check_violation', CONSTRAINT = constraint_name;
        END IF;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE FUNCTION app.check_ledger_entries_zero_sum() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM app.assert_transfer_balanced(NEW.transfer_id, 'tg_ledger_entries_zero_sum');
        RETURN NULL;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE FUNCTION app.check_transfers_completed_has_entries() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM app.assert_transfer_balanced(NEW.id, 'tg_transfers_completed_has_entries');
        RETURN NULL;
      END;
      $$
    `);
    for (const fn of [
      'assert_transfer_balanced(uuid, text)',
      'check_ledger_entries_zero_sum()',
      'check_transfers_completed_has_entries()',
    ]) {
      await queryRunner.query(`REVOKE ALL ON FUNCTION app.${fn} FROM PUBLIC`);
      await queryRunner.query(`GRANT EXECUTE ON FUNCTION app.${fn} TO wallet_app`);
    }
    await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER tg_ledger_entries_zero_sum
        AFTER INSERT ON app.ledger_entries
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW EXECUTE FUNCTION app.check_ledger_entries_zero_sum()
    `);
    await queryRunner.query(`
      CREATE CONSTRAINT TRIGGER tg_transfers_completed_has_entries
        AFTER INSERT OR UPDATE OF status ON app.transfers
        DEFERRABLE INITIALLY DEFERRED
        FOR EACH ROW WHEN (NEW.status = 'COMPLETED')
        EXECUTE FUNCTION app.check_transfers_completed_has_entries()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER tg_transfers_completed_has_entries ON app.transfers`);
    await queryRunner.query(`DROP TRIGGER tg_ledger_entries_zero_sum ON app.ledger_entries`);
    await queryRunner.query(`DROP FUNCTION app.check_transfers_completed_has_entries()`);
    await queryRunner.query(`DROP FUNCTION app.check_ledger_entries_zero_sum()`);
    await queryRunner.query(`DROP FUNCTION app.assert_transfer_balanced(uuid, text)`);
  }
}
