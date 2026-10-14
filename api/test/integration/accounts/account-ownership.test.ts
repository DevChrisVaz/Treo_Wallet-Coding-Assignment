import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { PgAccountRepository } from '../../../src/modules/accounts/infrastructure/pg-account-repository.js';
import { TREASURY_ACCOUNT_ID } from '../../../migrations/1760400002000-accounts.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { verifiedUser, type VerifiedUser } from '../../helpers/identity.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: VerifiedUser;
let luis: VerifiedUser;

beforeEach(async () => {
  t = await buildTestApp(harness);
  ana = await verifiedUser(t);
  luis = await verifiedUser(t);
});

describe('ACC-06 propiedad de las cuentas', () => {
  it('ACC-06 el listado de un usuario solo trae sus cuentas USER, en orden de apertura', async () => {
    const accounts = new PgAccountRepository(harness.app);
    const list = await accounts.listOwnedBy(ana.userId);
    expect(list.map((account) => account.name)).toEqual(['Principal', 'Ahorro']);
    expect(list.every((account) => account.userId === ana.userId)).toBe(true);
    expect(list.every((account) => account.balanceCents === 0n)).toBe(true);
  });

  it('ACC-06 una cuenta propia se encuentra', async () => {
    const accounts = new PgAccountRepository(harness.app);
    const [principal] = await accounts.listOwnedBy(ana.userId);
    expect(await accounts.findOwnedBy(ana.userId, principal?.id ?? '')).toMatchObject({
      id: principal?.id,
      name: 'Principal',
    });
  });

  it('ACC-06 una cuenta ajena, una inexistente y la Tesorería dan el mismo resultado vacío', async () => {
    const accounts = new PgAccountRepository(harness.app);
    const [luisAccount] = await accounts.listOwnedBy(luis.userId);
    const results = await Promise.all([
      accounts.findOwnedBy(ana.userId, luisAccount?.id ?? ''),
      accounts.findOwnedBy(ana.userId, randomUUID()),
      accounts.findOwnedBy(ana.userId, TREASURY_ACCOUNT_ID),
    ]);
    expect(results).toEqual([null, null, null]);
  });
});
