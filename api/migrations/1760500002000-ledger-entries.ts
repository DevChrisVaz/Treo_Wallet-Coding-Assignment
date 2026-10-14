import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Asientos del ledger de partida doble (TRF-21, HIS-09): dos por transferencia completada, uno
 * negativo y otro positivo, con el saldo resultante de la cuenta. Los índices están diseñados para
 * el historial: por cuenta en orden descendente de fecha e id, con y sin tipo.
 */
export class LedgerEntries1760500002000 implements MigrationInterface {
  name = 'LedgerEntries1760500002000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE app.ledger_entries (
        id                  bigint GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_ledger_entries PRIMARY KEY,
        transfer_id         uuid NOT NULL CONSTRAINT fk_ledger_entries_transfer REFERENCES app.transfers (id),
        account_id          uuid NOT NULL CONSTRAINT fk_ledger_entries_account REFERENCES app.accounts (id),
        type                text NOT NULL
                            CONSTRAINT ck_ledger_entries_type CHECK (type IN (
                              'DEPOSIT', 'TRANSFER_IN', 'TRANSFER_OUT', 'OWN_TRANSFER_IN', 'OWN_TRANSFER_OUT'
                            )),
        amount_cents        bigint NOT NULL
                            CONSTRAINT ck_ledger_entries_amount_nonzero CHECK (amount_cents <> 0),
        balance_after_cents bigint NOT NULL,
        created_at          timestamptz NOT NULL,
        CONSTRAINT uq_ledger_entries_transfer_account UNIQUE (transfer_id, account_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX ix_ledger_entries_account_created
        ON app.ledger_entries (account_id, created_at DESC, id DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX ix_ledger_entries_account_type_created
        ON app.ledger_entries (account_id, type, created_at DESC, id DESC)
    `);
    await queryRunner.query(`REVOKE ALL ON app.ledger_entries FROM PUBLIC`);
    await queryRunner.query(`GRANT SELECT, INSERT ON app.ledger_entries TO wallet_app`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE app.ledger_entries`);
  }
}
