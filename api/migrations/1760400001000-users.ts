import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Usuarios (IDN-02, IDN-03). Email, CURP, RFC y teléfono son únicos; el email solo se guarda
 * normalizado (sin espacios en los extremos y en minúsculas), así que `uq_users_email` no distingue
 * mayúsculas. El formato de CURP y RFC lo valida la aplicación; la base garantiza la unicidad.
 */
export class Users1760400001000 implements MigrationInterface {
  name = 'Users1760400001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.users (
        id                uuid CONSTRAINT pk_users PRIMARY KEY,
        email             text NOT NULL
                          CONSTRAINT ck_users_email_normalized CHECK (email = lower(btrim(email))),
        password_hash     text NOT NULL,
        full_name         text NOT NULL
                          CONSTRAINT ck_users_full_name_length
                          CHECK (char_length(full_name) BETWEEN 1 AND 100),
        curp              char(18) NOT NULL,
        rfc               char(13) NOT NULL,
        phone             text NOT NULL
                          CONSTRAINT ck_users_phone_e164 CHECK (phone ~ '^\\+52[0-9]{10}$'),
        email_verified_at timestamptz,
        created_at        timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_users_email UNIQUE (email),
        CONSTRAINT uq_users_curp UNIQUE (curp),
        CONSTRAINT uq_users_rfc UNIQUE (rfc),
        CONSTRAINT uq_users_phone UNIQUE (phone)
      )
    `);
    await queryRunner.query(`REVOKE ALL ON app.users FROM PUBLIC`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE ON app.users TO wallet_app`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE app.users`);
  }
}
