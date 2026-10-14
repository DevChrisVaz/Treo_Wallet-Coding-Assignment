import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Transferencias (TRF-02, TRF-07, TRF-09). La transferencia es también el registro de
 * idempotencia: `uq_transfers_user_idempotency_key`. Los fondeos de la Tesorería (`FUNDING`) no
 * tienen usuario ni llave. `EXPIRED` no se guarda: es `PENDING_OTP` con `otp_expires_at` vencido.
 */
export class Transfers1760500001000 implements MigrationInterface {
  name = 'Transfers1760500001000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.transfers (
        id                  uuid CONSTRAINT pk_transfers PRIMARY KEY,
        user_id             uuid CONSTRAINT fk_transfers_user REFERENCES app.users (id),
        idempotency_key     uuid,
        request_fingerprint text
                            CONSTRAINT ck_transfers_fingerprint_hex
                            CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
        kind                text NOT NULL
                            CONSTRAINT ck_transfers_kind CHECK (kind IN ('FUNDING', 'OWN', 'THIRD_PARTY')),
        status              text NOT NULL
                            CONSTRAINT ck_transfers_status
                            CHECK (status IN ('PENDING_OTP', 'COMPLETED', 'REJECTED', 'FAILED')),
        from_account_id     uuid NOT NULL CONSTRAINT fk_transfers_from_account REFERENCES app.accounts (id),
        to_account_id       uuid NOT NULL CONSTRAINT fk_transfers_to_account REFERENCES app.accounts (id),
        beneficiary_id      uuid CONSTRAINT fk_transfers_beneficiary REFERENCES app.beneficiaries (id),
        amount_cents        bigint NOT NULL CONSTRAINT ck_transfers_amount_positive CHECK (amount_cents > 0),
        concept             text NOT NULL
                            CONSTRAINT ck_transfers_concept_trimmed
                            CHECK (char_length(concept) BETWEEN 1 AND 40 AND concept ~ '^\\S(.*\\S)?$'),
        reference           integer NOT NULL
                            CONSTRAINT ck_transfers_reference_range CHECK (reference BETWEEN 0 AND 9999999),
        requires_otp        boolean NOT NULL,
        rejection_reason    text
                            CONSTRAINT ck_transfers_rejection_reason
                            CHECK (rejection_reason IN ('INSUFFICIENT_FUNDS', 'DAILY_LIMIT_EXCEEDED')),
        failure_reason      text
                            CONSTRAINT ck_transfers_failure_reason
                            CHECK (failure_reason IN ('INSUFFICIENT_FUNDS', 'DAILY_LIMIT_EXCEEDED',
                                                      'OTP_ATTEMPTS_EXHAUSTED')),
        otp_expires_at      timestamptz,
        created_at          timestamptz NOT NULL,
        completed_at        timestamptz,
        CONSTRAINT uq_transfers_user_idempotency_key UNIQUE (user_id, idempotency_key),
        CONSTRAINT ck_transfers_distinct_accounts CHECK (from_account_id <> to_account_id),
        CONSTRAINT ck_transfers_user_key_by_kind CHECK (
          kind = 'FUNDING'
          OR (user_id IS NOT NULL AND idempotency_key IS NOT NULL AND request_fingerprint IS NOT NULL)
        ),
        CONSTRAINT ck_transfers_beneficiary_by_kind
          CHECK ((kind = 'THIRD_PARTY') = (beneficiary_id IS NOT NULL)),
        CONSTRAINT ck_transfers_reason_by_status CHECK (
          ((status = 'REJECTED') = (rejection_reason IS NOT NULL))
          AND ((status = 'FAILED') = (failure_reason IS NOT NULL))
        ),
        CONSTRAINT ck_transfers_completed_at_by_status
          CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))
      )
    `);
    // Índices para las llaves foráneas: los bloqueos de cuentas no deben recorrer transferencias.
    await queryRunner.query(
      `CREATE INDEX ix_transfers_from_account ON app.transfers (from_account_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX ix_transfers_to_account ON app.transfers (to_account_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX ix_transfers_beneficiary ON app.transfers (beneficiary_id)`,
    );
    await queryRunner.query(`REVOKE ALL ON app.transfers FROM PUBLIC`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE ON app.transfers TO wallet_app`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE app.transfers`);
  }
}
