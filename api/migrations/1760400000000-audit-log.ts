import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bitácora de auditoría (AUD-01, AUD-04, AUD-05, AUD-06). Solo de inserción: `wallet_app` tiene
 * únicamente `INSERT` (sin `SELECT`, por eso los inserts no usan `RETURNING`), y los triggers
 * rechazan `UPDATE`, `DELETE` y `TRUNCATE` incluso al dueño del esquema. Sin llaves foráneas.
 * El catálogo de acciones está escrito aquí y no importado del dominio: una migración no cambia
 * aunque el código cambie después.
 */
export class AuditLog1760400000000 implements MigrationInterface {
  name = 'AuditLog1760400000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION app.forbid_mutation() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'La tabla % es de solo inserción: % no está permitido', TG_TABLE_NAME, TG_OP
          USING HINT = 'Las correcciones se registran como eventos o asientos nuevos.';
      END;
      $$
    `);
    await queryRunner.query(`REVOKE ALL ON FUNCTION app.forbid_mutation() FROM PUBLIC`);

    await queryRunner.query(`
      CREATE TABLE app.audit_log (
        id            bigint GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_audit_log PRIMARY KEY,
        occurred_at   timestamptz NOT NULL DEFAULT now(),
        actor_type    text NOT NULL
                      CONSTRAINT ck_audit_log_actor_type CHECK (actor_type IN ('USER', 'SYSTEM', 'ANONYMOUS')),
        actor_user_id uuid,
        action        text NOT NULL
                      CONSTRAINT ck_audit_log_action CHECK (action IN (
                        'USER_REGISTERED', 'EMAIL_VERIFIED', 'EMAIL_VERIFICATION_RESENT',
                        'LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'LOGOUT',
                        'REFRESH_TOKEN_REUSE_DETECTED', 'OTP_ATTEMPT_FAILED', 'OTP_ATTEMPTS_EXHAUSTED',
                        'BENEFICIARY_CREATED',
                        'TRANSFER_CREATED', 'TRANSFER_OTP_SENT', 'TRANSFER_OTP_RESENT',
                        'TRANSFER_COMPLETED', 'TRANSFER_REJECTED', 'TRANSFER_FAILED',
                        'FUNDING_POSTED'
                      )),
        entity_type   text,
        entity_id     text,
        request_id    text,
        ip            inet,
        user_agent    text,
        metadata      jsonb NOT NULL DEFAULT '{}'::jsonb
                      CONSTRAINT ck_audit_log_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
      )
    `);

    await queryRunner.query(`
      CREATE TRIGGER tg_audit_log_no_update_delete
        BEFORE UPDATE OR DELETE ON app.audit_log
        FOR EACH ROW EXECUTE FUNCTION app.forbid_mutation()
    `);
    await queryRunner.query(`
      CREATE TRIGGER tg_audit_log_no_truncate
        BEFORE TRUNCATE ON app.audit_log
        FOR EACH STATEMENT EXECUTE FUNCTION app.forbid_mutation()
    `);

    await queryRunner.query(`REVOKE ALL ON app.audit_log FROM PUBLIC`);
    await queryRunner.query(`GRANT INSERT ON app.audit_log TO wallet_app`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE app.audit_log`);
    await queryRunner.query(`DROP FUNCTION app.forbid_mutation()`);
  }
}
