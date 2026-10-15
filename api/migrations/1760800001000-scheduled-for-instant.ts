import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Programadas con hora (TRF-27): `scheduled_for` pasa de `date` a `timestamptz`, un
 * instante con precisión de minuto. Las filas existentes eran una fecha de CDMX sin hora; se
 * conservan a las 09:00 de America/Mexico_City de ese día.
 *
 * `ALTER COLUMN ... TYPE` reconstruye `ix_transfers_scheduled_due` y `ix_transfers_user_scheduled`
 * (ambos incluyen la columna) con el mismo orden. `ck_transfers_scheduled_for_minute` impide
 * guardar segundos o fracciones, como exige el contrato; las filas migradas (09:00:00) lo cumplen.
 *
 * `down` vuelve a `date` con el día de CDMX del instante: la hora se pierde.
 */
export class ScheduledForInstant1760800001000 implements MigrationInterface {
  name = 'ScheduledForInstant1760800001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.transfers
        ALTER COLUMN scheduled_for TYPE timestamptz
        USING (scheduled_for + time '09:00') AT TIME ZONE 'America/Mexico_City'
    `);
    await queryRunner.query(`
      ALTER TABLE app.transfers
        ADD CONSTRAINT ck_transfers_scheduled_for_minute
          CHECK (scheduled_for IS NULL OR date_trunc('minute', scheduled_for) = scheduled_for)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE app.transfers DROP CONSTRAINT ck_transfers_scheduled_for_minute`,
    );
    await queryRunner.query(`
      ALTER TABLE app.transfers
        ALTER COLUMN scheduled_for TYPE date
        USING (scheduled_for AT TIME ZONE 'America/Mexico_City')::date
    `);
  }
}
