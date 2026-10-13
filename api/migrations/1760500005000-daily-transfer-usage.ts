import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fila contador del límite diario (TRF-11, TRF-13): una por usuario y día de America/Mexico_City.
 * `limit_cents` se copia de la configuración al crear la fila para que el CHECK
 * `used_cents <= limit_cents` viva en la misma tabla: la base impide superar el límite aunque la
 * validación del servicio fallara. La fila se bloquea antes que las cuentas, serializando las
 * transferencias a terceros de un mismo usuario.
 */
export class DailyTransferUsage1760500005000 implements MigrationInterface {
  name = 'DailyTransferUsage1760500005000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.daily_transfer_usage (
        user_id     uuid NOT NULL CONSTRAINT fk_daily_transfer_usage_user REFERENCES app.users (id),
        day         date NOT NULL,
        used_cents  bigint NOT NULL DEFAULT 0
                    CONSTRAINT ck_daily_transfer_usage_non_negative CHECK (used_cents >= 0),
        limit_cents bigint NOT NULL
                    CONSTRAINT ck_daily_transfer_usage_limit_positive CHECK (limit_cents > 0),
        CONSTRAINT pk_daily_transfer_usage PRIMARY KEY (user_id, day),
        CONSTRAINT ck_daily_transfer_usage_within_limit CHECK (used_cents <= limit_cents)
      )
    `);
    await queryRunner.query(`REVOKE ALL ON app.daily_transfer_usage FROM PUBLIC`);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE ON app.daily_transfer_usage TO wallet_app`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE app.daily_transfer_usage`);
  }
}
