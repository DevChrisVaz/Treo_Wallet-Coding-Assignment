import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Beneficiarios (BEN-08): CLABE de una cuenta USER de la plataforma registrada por un usuario. La
 * base impide duplicados por usuario y CLABE o por usuario y alias, y CLABEs con dígito
 * verificador inválido, aunque la aplicación no lo valide. `account_id` guarda la cuenta resuelta.
 */
export class Beneficiaries1760500000000 implements MigrationInterface {
  name = 'Beneficiaries1760500000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.beneficiaries (
        id         uuid CONSTRAINT pk_beneficiaries PRIMARY KEY,
        user_id    uuid NOT NULL CONSTRAINT fk_beneficiaries_user REFERENCES app.users (id),
        account_id uuid NOT NULL CONSTRAINT fk_beneficiaries_account REFERENCES app.accounts (id),
        name       text NOT NULL
                   CONSTRAINT ck_beneficiaries_name_length CHECK (char_length(name) BETWEEN 1 AND 100),
        alias      text NOT NULL
                   CONSTRAINT ck_beneficiaries_alias_trimmed
                   CHECK (char_length(alias) BETWEEN 1 AND 30 AND alias ~ '^\\S(.*\\S)?$'),
        clabe      text NOT NULL
                   CONSTRAINT ck_beneficiaries_clabe_valid CHECK (app.clabe_is_valid(clabe)),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_beneficiaries_user_clabe UNIQUE (user_id, clabe),
        CONSTRAINT uq_beneficiaries_user_alias UNIQUE (user_id, alias)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX ix_beneficiaries_account ON app.beneficiaries (account_id)`,
    );
    await queryRunner.query(`REVOKE ALL ON app.beneficiaries FROM PUBLIC`);
    await queryRunner.query(`GRANT SELECT, INSERT ON app.beneficiaries TO wallet_app`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE app.beneficiaries`);
  }
}
