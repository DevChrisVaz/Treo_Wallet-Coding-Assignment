import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { beneficiaryRow, insertRow, violation } from '../../helpers/db-constraints.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { insertUserWithAccounts } from '../../helpers/ledger-fixtures.js';
import { sqlState } from '../../helpers/pg.js';

const harness = useIntegrationHarness();

async function parties() {
  const ana = await insertUserWithAccounts(harness.migrator);
  const luis = await insertUserWithAccounts(harness.migrator);
  return { ana, luis };
}

describe('BEN-08 unicidad de beneficiarios garantizada por la base', () => {
  it('BEN-08 la base rechaza la misma CLABE dos veces para un usuario aunque el alias sea otro', async () => {
    const { ana, luis } = await parties();
    await insertRow(harness.app, 'app.beneficiaries', beneficiaryRow(ana, luis));
    const error = await violation(
      insertRow(harness.app, 'app.beneficiaries', beneficiaryRow(ana, luis, { alias: 'Otro' })),
    );
    expect(error).toMatchObject({ code: '23505', constraint: 'uq_beneficiaries_user_clabe' });
  });

  it('BEN-08 la base rechaza el mismo alias dos veces para un usuario aunque la CLABE sea otra', async () => {
    const { ana, luis } = await parties();
    await insertRow(harness.app, 'app.beneficiaries', beneficiaryRow(ana, luis));
    const error = await violation(
      insertRow(
        harness.app,
        'app.beneficiaries',
        beneficiaryRow(ana, luis, { account_id: luis.ahorroId, clabe: luis.ahorroClabe }),
      ),
    );
    expect(error).toMatchObject({ code: '23505', constraint: 'uq_beneficiaries_user_alias' });
  });

  it('BEN-07 otro usuario sí puede registrar la misma CLABE y el mismo alias', async () => {
    const { ana, luis } = await parties();
    const eva = await insertUserWithAccounts(harness.migrator);
    await insertRow(harness.app, 'app.beneficiaries', beneficiaryRow(ana, luis));
    await insertRow(harness.app, 'app.beneficiaries', beneficiaryRow(eva, luis));
  });
});

describe('BEN-07 formato de los beneficiarios en la base', () => {
  it.each([
    ['vacío', ''],
    ['de 101 caracteres', 'n'.repeat(101)],
  ])('BEN-07 rechaza un nombre %s por ck_beneficiaries_name_length', async (_label, name) => {
    const { ana, luis } = await parties();
    const error = await violation(
      insertRow(harness.app, 'app.beneficiaries', beneficiaryRow(ana, luis, { name })),
    );
    expect(error).toMatchObject({ code: '23514', constraint: 'ck_beneficiaries_name_length' });
  });

  it.each([
    ['de 1 caracter', 'n'],
    ['de 100 caracteres', 'n'.repeat(100)],
  ])('BEN-07 acepta un nombre %s', async (_label, name) => {
    const { ana, luis } = await parties();
    await insertRow(harness.app, 'app.beneficiaries', beneficiaryRow(ana, luis, { name }));
  });

  it.each([
    ['vacío', ''],
    ['con espacio al inicio', ' Luis'],
    ['con espacio al final', 'Luis '],
    ['con salto de línea al final', 'Luis\n'],
    ['de 31 caracteres', 'a'.repeat(31)],
  ])('BEN-07 rechaza un alias %s por ck_beneficiaries_alias_trimmed', async (_label, alias) => {
    const { ana, luis } = await parties();
    const error = await violation(
      insertRow(harness.app, 'app.beneficiaries', beneficiaryRow(ana, luis, { alias })),
    );
    expect(error).toMatchObject({ code: '23514', constraint: 'ck_beneficiaries_alias_trimmed' });
  });

  it.each([
    ['de 1 caracter', 'a'],
    ['de 30 caracteres', 'a'.repeat(30)],
    ['con espacios internos', 'Mi amigo Luis'],
  ])('BEN-07 acepta un alias %s', async (_label, alias) => {
    const { ana, luis } = await parties();
    await insertRow(harness.app, 'app.beneficiaries', beneficiaryRow(ana, luis, { alias }));
  });
});

describe('BEN-08 llaves foráneas y privilegios de beneficiarios', () => {
  it('BEN-08 el usuario que registra debe existir (fk_beneficiaries_user)', async () => {
    const { ana, luis } = await parties();
    const error = await violation(
      insertRow(
        harness.app,
        'app.beneficiaries',
        beneficiaryRow(ana, luis, { user_id: randomUUID() }),
      ),
    );
    expect(error).toMatchObject({ code: '23503', constraint: 'fk_beneficiaries_user' });
  });

  it('BEN-08 la cuenta del beneficiario debe existir (fk_beneficiaries_account)', async () => {
    const { ana, luis } = await parties();
    const error = await violation(
      insertRow(
        harness.app,
        'app.beneficiaries',
        beneficiaryRow(ana, luis, { account_id: randomUUID() }),
      ),
    );
    expect(error).toMatchObject({ code: '23503', constraint: 'fk_beneficiaries_account' });
  });

  it.each([
    ['name', `'Otro'`],
    ['alias', `'Otro'`],
    ['clabe', `'${'0'.repeat(18)}'`],
    ['account_id', 'gen_random_uuid()'],
  ])('BEN-08 wallet_app no puede actualizar %s (42501)', async (column, value) => {
    const { ana, luis } = await parties();
    const row = beneficiaryRow(ana, luis);
    await insertRow(harness.app, 'app.beneficiaries', row);
    expect(
      await sqlState(
        harness.app.query(`UPDATE beneficiaries SET ${column} = ${value} WHERE id = $1`, [row.id]),
      ),
    ).toBe('42501');
  });

  it('BEN-08 wallet_app no puede borrar beneficiarios (42501)', async () => {
    const { ana, luis } = await parties();
    const row = beneficiaryRow(ana, luis);
    await insertRow(harness.app, 'app.beneficiaries', row);
    expect(
      await sqlState(harness.app.query(`DELETE FROM beneficiaries WHERE id = $1`, [row.id])),
    ).toBe('42501');
  });
});
