import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Códigos de entidad de la CURP (las 32 entidades y `NE`); mismo catálogo que `BIRTH_STATES` del contrato. */
const BIRTH_STATES =
  "'AS','BC','BS','CC','CL','CM','CS','CH','DF','DG','GT','GR','HG','JC','MC','MN','MS','NT','NL','OC','PL','QT','QR','SP','SL','SR','TC','TS','TL','VZ','YN','ZS','NE'";

/**
 * Nombre separado y datos de nacimiento en `users` (IDN-02). `full_name` se sigue guardando: la API
 * lo compone con los tres campos. Las columnas son `NOT NULL` y sin valor por defecto: es un
 * ambiente de pruebas sin usuarios que conservar, así que la migración no rellena nada; las filas
 * que ya existan en una base local se corrigen antes con SQL directo.
 *
 * `down` quita las cinco columnas; se pierden el nombre separado y los datos de nacimiento.
 */
export class RegistrationBirthData1760900000000 implements MigrationInterface {
  name = 'RegistrationBirthData1760900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.users
        ADD COLUMN first_names      text NOT NULL
                    CONSTRAINT ck_users_first_names_length
                    CHECK (char_length(first_names) BETWEEN 1 AND 100),
        ADD COLUMN paternal_surname text NOT NULL
                    CONSTRAINT ck_users_paternal_surname_length
                    CHECK (char_length(paternal_surname) BETWEEN 1 AND 100),
        ADD COLUMN maternal_surname text
                    CONSTRAINT ck_users_maternal_surname_length
                    CHECK (char_length(maternal_surname) BETWEEN 1 AND 100),
        ADD COLUMN birth_date       date NOT NULL,
        ADD COLUMN birth_state      char(2) NOT NULL
                    CONSTRAINT ck_users_birth_state CHECK (birth_state IN (${BIRTH_STATES}))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE app.users
        DROP COLUMN birth_state,
        DROP COLUMN birth_date,
        DROP COLUMN maternal_surname,
        DROP COLUMN paternal_surname,
        DROP COLUMN first_names
    `);
  }
}
