import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Id fijo de la cuenta SYSTEM "Tesorería": el arnés de pruebas y el seed la reconocen por él. */
export const TREASURY_ACCOUNT_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Cuentas (ACC-01, ACC-02, ACC-03, ACC-05). Las garantías viven en la base:
 * - una cuenta USER siempre tiene dueño y CLABE; la SYSTEM nunca;
 * - existe a lo más una cuenta SYSTEM (índice único parcial) y la crea esta migración;
 * - el saldo de una cuenta USER nunca es negativo (la SYSTEM sí puede: es el dinero emitido);
 * - la CLABE es única y su dígito verificador lo valida `clabe_is_valid()`, la misma regla que
 *   aplica la aplicación y que se prueba con los mismos vectores.
 * `wallet_app` solo puede actualizar `balance_cents` (privilegio por columna).
 */
export class Accounts1760400002000 implements MigrationInterface {
  name = 'Accounts1760400002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Pesos 3, 7, 1 sobre los primeros 17 dígitos, cada producto módulo 10; DV = (10 − Σ mod 10) mod 10.
    await queryRunner.query(`
      CREATE FUNCTION app.clabe_is_valid(clabe text) RETURNS boolean
      LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
        SELECT CASE
          WHEN clabe !~ '^[0-9]{18}$' THEN false
          ELSE (10 - (
                 SELECT sum((substr(clabe, i, 1)::int * (ARRAY[3, 7, 1])[((i - 1) % 3) + 1]) % 10)
                   FROM generate_series(1, 17) AS i
               ) % 10) % 10 = substr(clabe, 18, 1)::int
        END
      $$
    `);
    await queryRunner.query(`REVOKE ALL ON FUNCTION app.clabe_is_valid(text) FROM PUBLIC`);
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION app.clabe_is_valid(text) TO wallet_app`);

    // Número de cuenta de 11 dígitos de la CLABE.
    await queryRunner.query(`
      CREATE SEQUENCE app.seq_account_number AS bigint MINVALUE 1 MAXVALUE 99999999999 NO CYCLE
    `);
    await queryRunner.query(`REVOKE ALL ON SEQUENCE app.seq_account_number FROM PUBLIC`);
    await queryRunner.query(`GRANT USAGE ON SEQUENCE app.seq_account_number TO wallet_app`);

    await queryRunner.query(`
      CREATE TABLE app.accounts (
        id            uuid CONSTRAINT pk_accounts PRIMARY KEY,
        user_id       uuid CONSTRAINT fk_accounts_user REFERENCES app.users (id),
        type          text NOT NULL CONSTRAINT ck_accounts_type CHECK (type IN ('USER', 'SYSTEM')),
        name          text NOT NULL
                      CONSTRAINT ck_accounts_name_length CHECK (char_length(name) BETWEEN 1 AND 50),
        clabe         text
                      CONSTRAINT ck_accounts_clabe_valid CHECK (clabe IS NULL OR app.clabe_is_valid(clabe)),
        balance_cents bigint NOT NULL DEFAULT 0,
        created_at    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT ck_accounts_owner_by_type CHECK ((type = 'USER') = (user_id IS NOT NULL)),
        CONSTRAINT ck_accounts_clabe_by_type CHECK ((type = 'USER') = (clabe IS NOT NULL)),
        CONSTRAINT ck_accounts_balance_non_negative CHECK (type = 'SYSTEM' OR balance_cents >= 0),
        CONSTRAINT uq_accounts_clabe UNIQUE (clabe),
        CONSTRAINT uq_accounts_user_name UNIQUE (user_id, name)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_accounts_single_system ON app.accounts (type) WHERE type = 'SYSTEM'
    `);

    await queryRunner.query(
      `INSERT INTO app.accounts (id, type, name) VALUES ($1, 'SYSTEM', 'Tesorería')`,
      [TREASURY_ACCOUNT_ID],
    );

    await queryRunner.query(`REVOKE ALL ON app.accounts FROM PUBLIC`);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE (balance_cents) ON app.accounts TO wallet_app`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE app.accounts`);
    await queryRunner.query(`DROP SEQUENCE app.seq_account_number`);
    await queryRunner.query(`DROP FUNCTION app.clabe_is_valid(text)`);
  }
}
