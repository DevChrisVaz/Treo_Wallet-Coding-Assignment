import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Estados de `Transfers1760500001000`, escritos aquí: una migración no cambia aunque el código sí. */
const PREVIOUS_STATUSES = ['PENDING_OTP', 'COMPLETED', 'REJECTED', 'FAILED'];
const NEW_STATUSES = ['SCHEDULED', 'CANCELLED'];

const list = (values: readonly string[]) => values.map((value) => `'${value}'`).join(', ');

/**
 * Transferencias programadas (TRF-27, TRF-30, TRF-32, TRF-34; D1 de scheduled-transfers):
 * - `scheduled_for`: fecha de la Ciudad de México en que se ejecuta; nula en las inmediatas.
 * - `cancelled_at`: momento de la cancelación, solo en `CANCELLED`.
 * - `SCHEDULED` (espera su fecha) y `CANCELLED` (final, sin dinero) en `ck_transfers_status`.
 * - Índices parciales sobre `SCHEDULED`: el del ejecutor, en su orden de ejecución, y el de la lista
 *   y el tope por usuario.
 *
 * Todo es aditivo: columnas nulas, constraints que las filas existentes ya cumplen e índices sobre
 * un estado que aún no existe. `wallet_app` ya tiene `UPDATE` sobre `transfers`, así que no hay
 * privilegios nuevos. `ck_transfers_reason_by_status` y `ck_transfers_completed_at_by_status` no
 * cambian: una programada ejecutada cumple las mismas reglas que una inmediata.
 */
export class ScheduledTransfers1760700000000 implements MigrationInterface {
  name = 'ScheduledTransfers1760700000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.transfers
        ADD COLUMN scheduled_for date,
        ADD COLUMN cancelled_at  timestamptz
    `);
    await queryRunner.query(`ALTER TABLE app.transfers DROP CONSTRAINT ck_transfers_status`);
    await queryRunner.query(
      `ALTER TABLE app.transfers ADD CONSTRAINT ck_transfers_status
         CHECK (status IN (${list([...PREVIOUS_STATUSES, ...NEW_STATUSES])}))`,
    );
    await queryRunner.query(`
      ALTER TABLE app.transfers
        ADD CONSTRAINT ck_transfers_scheduled_has_date
          CHECK (status NOT IN ('SCHEDULED', 'CANCELLED') OR scheduled_for IS NOT NULL),
        ADD CONSTRAINT ck_transfers_cancelled_at_by_status
          CHECK ((status = 'CANCELLED') = (cancelled_at IS NOT NULL))
    `);
    await queryRunner.query(`
      CREATE INDEX ix_transfers_scheduled_due ON app.transfers (scheduled_for, created_at, id)
        WHERE status = 'SCHEDULED'
    `);
    await queryRunner.query(`
      CREATE INDEX ix_transfers_user_scheduled ON app.transfers (user_id, scheduled_for, created_at)
        WHERE status = 'SCHEDULED'
    `);
  }

  /**
   * Solo se puede revertir si nunca hubo transferencias programadas: quitar las columnas borraría
   * la fecha de las ya ejecutadas y dejaría sin significado a las `SCHEDULED` y `CANCELLED`. La
   * tabla se bloquea antes de revisar, para que nadie programe entre la revisión y los cambios.
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`LOCK TABLE app.transfers IN ACCESS EXCLUSIVE MODE`);
    const [row] = (await queryRunner.query(
      `SELECT count(*)::int AS scheduled FROM app.transfers
        WHERE status IN (${list(NEW_STATUSES)}) OR scheduled_for IS NOT NULL`,
    )) as { scheduled: number }[];
    const scheduled = row?.scheduled ?? 0;
    if (scheduled > 0) {
      throw new Error(
        `No se puede revertir ScheduledTransfers1760700000000: existen ${scheduled} transferencias ` +
          'programadas (pendientes, ejecutadas o canceladas). Deshabilita SCHEDULER_ENABLED y decide ' +
          'qué hacer con ellas antes de revertir.',
      );
    }
    await queryRunner.query(`DROP INDEX app.ix_transfers_user_scheduled`);
    await queryRunner.query(`DROP INDEX app.ix_transfers_scheduled_due`);
    await queryRunner.query(`
      ALTER TABLE app.transfers
        DROP CONSTRAINT ck_transfers_cancelled_at_by_status,
        DROP CONSTRAINT ck_transfers_scheduled_has_date,
        DROP CONSTRAINT ck_transfers_status
    `);
    await queryRunner.query(
      `ALTER TABLE app.transfers ADD CONSTRAINT ck_transfers_status
         CHECK (status IN (${list(PREVIOUS_STATUSES)}))`,
    );
    await queryRunner.query(`
      ALTER TABLE app.transfers
        DROP COLUMN cancelled_at,
        DROP COLUMN scheduled_for
    `);
  }
}
