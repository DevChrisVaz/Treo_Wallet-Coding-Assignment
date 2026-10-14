import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Catálogo de `AuditLog1760400000000`, escrito aquí: una migración no cambia aunque el código sí. */
const PREVIOUS_ACTIONS = [
  'USER_REGISTERED',
  'EMAIL_VERIFIED',
  'EMAIL_VERIFICATION_RESENT',
  'LOGIN_SUCCEEDED',
  'LOGIN_FAILED',
  'LOGOUT',
  'REFRESH_TOKEN_REUSE_DETECTED',
  'OTP_ATTEMPT_FAILED',
  'OTP_ATTEMPTS_EXHAUSTED',
  'BENEFICIARY_CREATED',
  'TRANSFER_CREATED',
  'TRANSFER_OTP_SENT',
  'TRANSFER_OTP_RESENT',
  'TRANSFER_COMPLETED',
  'TRANSFER_REJECTED',
  'TRANSFER_FAILED',
  'FUNDING_POSTED',
];

const list = (actions: readonly string[]) => actions.map((action) => `'${action}'`).join(', ');

/**
 * `STATEMENT_EXPORTED` en el catálogo de la bitácora (AUD-07, D10 de account-statements): la
 * constraint se recrea con el valor nuevo. Las acciones son las mismas más una, así que la
 * validación de las filas existentes siempre pasa.
 *
 * El `down` vuelve a la lista anterior con `NOT VALID`: rige para las filas nuevas, pero no revisa
 * las que ya existen. La bitácora es inmutable, así que los `STATEMENT_EXPORTED` ya escritos no se
 * pueden borrar y una constraint validada haría imposible revertir.
 */
export class AuditStatementExported1760600000000 implements MigrationInterface {
  name = 'AuditStatementExported1760600000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE app.audit_log DROP CONSTRAINT ck_audit_log_action`);
    await queryRunner.query(
      `ALTER TABLE app.audit_log ADD CONSTRAINT ck_audit_log_action
         CHECK (action IN (${list([...PREVIOUS_ACTIONS, 'STATEMENT_EXPORTED'])}))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE app.audit_log DROP CONSTRAINT ck_audit_log_action`);
    await queryRunner.query(
      `ALTER TABLE app.audit_log ADD CONSTRAINT ck_audit_log_action
         CHECK (action IN (${list(PREVIOUS_ACTIONS)})) NOT VALID`,
    );
  }
}
