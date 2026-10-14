import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refresh tokens (IDN-11, IDN-12) y códigos de un solo uso (IDN-05).
 *
 * - `refresh_tokens`: solo el SHA-256 del token; cada token pertenece a una familia (sesión) y
 *   apunta a su sucesor. Las revocaciones son UPDATE con motivo; nunca se borran filas.
 * - `one_time_codes`: un desafío por propósito y sujeto (usuario o transferencia, sin FK porque es
 *   polimórfico). Reenviar reemplaza el hash en la misma fila. Solo el HMAC-SHA256 del código.
 */
export class SessionsAndCodes1760400003000 implements MigrationInterface {
  name = 'SessionsAndCodes1760400003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.refresh_tokens (
        id                uuid CONSTRAINT pk_refresh_tokens PRIMARY KEY,
        user_id           uuid NOT NULL CONSTRAINT fk_refresh_tokens_user REFERENCES app.users (id),
        family_id         uuid NOT NULL,
        token_hash        text NOT NULL
                          CONSTRAINT ck_refresh_tokens_token_hash_hex CHECK (token_hash ~ '^[0-9a-f]{64}$'),
        issued_at         timestamptz NOT NULL,
        expires_at        timestamptz NOT NULL,
        family_expires_at timestamptz NOT NULL,
        used_at           timestamptz,
        replaced_by       uuid CONSTRAINT fk_refresh_tokens_replaced_by REFERENCES app.refresh_tokens (id),
        revoked_at        timestamptz,
        revoked_reason    text CONSTRAINT ck_refresh_tokens_revoked_reason
                          CHECK (revoked_reason IN ('LOGOUT', 'REUSE_DETECTED', 'GRACE_SUPERSEDED')),
        CONSTRAINT uq_refresh_tokens_token_hash UNIQUE (token_hash),
        CONSTRAINT ck_refresh_tokens_revocation CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL)),
        CONSTRAINT ck_refresh_tokens_expiry CHECK (expires_at <= family_expires_at)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX ix_refresh_tokens_family ON app.refresh_tokens (family_id)`,
    );
    await queryRunner.query(`CREATE INDEX ix_refresh_tokens_user ON app.refresh_tokens (user_id)`);
    await queryRunner.query(`REVOKE ALL ON app.refresh_tokens FROM PUBLIC`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE ON app.refresh_tokens TO wallet_app`);

    await queryRunner.query(`
      CREATE TABLE app.one_time_codes (
        id           uuid CONSTRAINT pk_one_time_codes PRIMARY KEY,
        purpose      text NOT NULL CONSTRAINT ck_one_time_codes_purpose
                     CHECK (purpose IN ('EMAIL_VERIFICATION', 'TRANSFER_CONFIRMATION')),
        subject_id   uuid NOT NULL,
        code_hash    text NOT NULL
                     CONSTRAINT ck_one_time_codes_code_hash_hex CHECK (code_hash ~ '^[0-9a-f]{64}$'),
        attempts     smallint NOT NULL DEFAULT 0
                     CONSTRAINT ck_one_time_codes_attempts CHECK (attempts BETWEEN 0 AND 3),
        resend_count smallint NOT NULL DEFAULT 0
                     CONSTRAINT ck_one_time_codes_resend_count CHECK (resend_count BETWEEN 0 AND 3),
        expires_at   timestamptz NOT NULL,
        consumed_at  timestamptz,
        created_at   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_one_time_codes_purpose_subject UNIQUE (purpose, subject_id)
      )
    `);
    await queryRunner.query(`REVOKE ALL ON app.one_time_codes FROM PUBLIC`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE ON app.one_time_codes TO wallet_app`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE app.one_time_codes`);
    await queryRunner.query(`DROP TABLE app.refresh_tokens`);
  }
}
