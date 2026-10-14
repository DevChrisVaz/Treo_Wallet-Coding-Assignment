import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catálogo vigente después de `AuditStatementExported1760600000000`, escrito aquí: una migración no
 * cambia aunque el código sí.
 */
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
  'STATEMENT_EXPORTED',
];

const list = (actions: readonly string[]) => actions.map((action) => `'${action}'`).join(', ');

/**
 * `TRANSFER_SCHEDULED` y `TRANSFER_CANCELLED` en el catálogo de la bitácora (AUD-08, D1 de
 * scheduled-transfers). La constraint se recrea con los valores nuevos y conserva
 * `STATEMENT_EXPORTED`; son las mismas acciones más dos, así que la validación de las filas
 * existentes siempre pasa.
 *
 * El `down` vuelve a la lista anterior con `NOT VALID`, como el de `STATEMENT_EXPORTED`: la bitácora
 * es inmutable, así que los eventos ya escritos no se pueden borrar y una constraint validada haría
 * imposible revertir.
 */
export class AuditScheduledTransfers1760700001000 implements MigrationInterface {
  name = 'AuditScheduledTransfers1760700001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE app.audit_log DROP CONSTRAINT ck_audit_log_action`);
    await queryRunner.query(
      `ALTER TABLE app.audit_log ADD CONSTRAINT ck_audit_log_action
         CHECK (action IN (${list([...PREVIOUS_ACTIONS, 'TRANSFER_SCHEDULED', 'TRANSFER_CANCELLED'])}))`,
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
