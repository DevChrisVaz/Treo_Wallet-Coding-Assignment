import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Referencia opcional (TRF-08, TRF-09): `app.transfers.reference` pasa a admitir `NULL`,
 * que significa "sin referencia". Es la única tabla con una referencia: los asientos y los
 * movimientos la leen de la transferencia. `ck_transfers_reference_range` no cambia, porque un
 * `CHECK` con `NULL` no se viola.
 *
 * Los fondeos de la Tesorería nunca tuvieron una referencia real (guardaban 0 y el historial
 * mostraba "Referencia 0"), así que sus filas existentes también pasan a `NULL`.
 *
 * `down` devuelve el `NOT NULL` y guarda 0 donde no hay referencia; la distinción entre "0" y "sin
 * referencia" se pierde.
 */
export class OptionalTransferReference1760800000000 implements MigrationInterface {
  name = 'OptionalTransferReference1760800000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE app.transfers ALTER COLUMN reference DROP NOT NULL`);
    await queryRunner.query(`UPDATE app.transfers SET reference = NULL WHERE kind = 'FUNDING'`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE app.transfers SET reference = 0 WHERE reference IS NULL`);
    await queryRunner.query(`ALTER TABLE app.transfers ALTER COLUMN reference SET NOT NULL`);
  }
}
