import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catálogo vigente después de `AuditScheduledTransfers1760700001000`, escrito aquí: una migración no
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
  'TRANSFER_SCHEDULED',
  'TRANSFER_CANCELLED',
];

const IDENTITY_COLUMNS = ['curp', 'rfc', 'phone'] as const;

const list = (actions: readonly string[]) => actions.map((action) => `'${action}'`).join(', ');

/**
 * Registros en revisión (IDN-03, D2 de registration-review). `users.identity_conflict` marca al
 * usuario cuya CURP, RFC o teléfono ya eran de otro al registrarse. La unicidad de esos tres datos
 * pasa de constraints a índices únicos parciales con los mismos nombres, que solo cuentan a los
 * usuarios que no están en revisión: la traducción de errores por nombre no cambia. El email sigue
 * siendo único entre todos. `REGISTRATION_IN_REVIEW` entra al catálogo de la bitácora (AUD-01).
 *
 * El `down` se niega mientras exista un usuario en revisión: las constraints únicas fallarían con
 * sus datos repetidos. La bitácora vuelve a la lista anterior con `NOT VALID`, como en las
 * migraciones de auditoría anteriores, porque los eventos ya escritos no se pueden borrar.
 */
export class RegistrationReview1761000000000 implements MigrationInterface {
  name = 'RegistrationReview1761000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE app.users ADD COLUMN identity_conflict boolean NOT NULL DEFAULT false`,
    );
    for (const column of IDENTITY_COLUMNS) {
      await queryRunner.query(`ALTER TABLE app.users DROP CONSTRAINT uq_users_${column}`);
      await queryRunner.query(
        `CREATE UNIQUE INDEX uq_users_${column} ON app.users (${column}) WHERE NOT identity_conflict`,
      );
    }
    await queryRunner.query(`ALTER TABLE app.audit_log DROP CONSTRAINT ck_audit_log_action`);
    await queryRunner.query(
      `ALTER TABLE app.audit_log ADD CONSTRAINT ck_audit_log_action
         CHECK (action IN (${list([...PREVIOUS_ACTIONS, 'REGISTRATION_IN_REVIEW'])}))`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [row] = (await queryRunner.query(
      `SELECT count(*)::int AS in_review FROM app.users WHERE identity_conflict`,
    )) as { in_review: number }[];
    if (row && row.in_review > 0) {
      throw new Error(
        `Hay ${row.in_review} usuarios en revisión: resuélvelos antes de revertir esta migración`,
      );
    }
    for (const column of IDENTITY_COLUMNS) {
      await queryRunner.query(`DROP INDEX app.uq_users_${column}`);
      await queryRunner.query(
        `ALTER TABLE app.users ADD CONSTRAINT uq_users_${column} UNIQUE (${column})`,
      );
    }
    await queryRunner.query(`ALTER TABLE app.users DROP COLUMN identity_conflict`);
    await queryRunner.query(`ALTER TABLE app.audit_log DROP CONSTRAINT ck_audit_log_action`);
    await queryRunner.query(
      `ALTER TABLE app.audit_log ADD CONSTRAINT ck_audit_log_action
         CHECK (action IN (${list(PREVIOUS_ACTIONS)})) NOT VALID`,
    );
  }
}
