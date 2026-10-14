import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { TREASURY_ACCOUNT_ID } from '../../../migrations/1760400002000-accounts.js';
import { Money } from '../../../src/shared/money.js';
import { DomainError } from '../../../src/shared/errors.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { addBeneficiary, ledgerUser, type LedgerUser } from '../../helpers/ledger-api.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;

beforeEach(async () => {
  t = await buildTestApp(harness);
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
});

const amount = Money.parse('10.00');

async function codeOf(promise: Promise<unknown>) {
  try {
    await promise;
    return 'OK';
  } catch (error) {
    return error instanceof DomainError ? error.code : String(error);
  }
}

function resolve(
  userId: string,
  fromAccountId: string,
  destination: { type: 'OWN_ACCOUNT' | 'BENEFICIARY'; id: string },
) {
  return t.container.transfers.destinations.resolve(userId, {
    fromAccountId,
    destination,
    amount,
    concept: 'Prueba',
    reference: 1,
  });
}

describe('TRF-06 resolución del destino y de la propiedad', () => {
  it('TRF-06 un beneficiario propio resuelve a su cuenta y la transferencia es THIRD_PARTY', async () => {
    const beneficiaryId = await addBeneficiary(t, ana, {
      name: 'Luis',
      alias: 'Luis',
      clabe: luis.principal.clabe,
    });
    expect(
      await resolve(ana.userId, ana.principal.id, { type: 'BENEFICIARY', id: beneficiaryId }),
    ).toEqual({
      kind: 'THIRD_PARTY',
      fromAccountId: ana.principal.id,
      toAccountId: luis.principal.id,
      beneficiaryId,
    });
  });

  it('TRF-06 una cuenta propia como destino es OWN, sin importar lo que diga el cliente', async () => {
    expect(
      await resolve(ana.userId, ana.principal.id, { type: 'OWN_ACCOUNT', id: ana.ahorro.id }),
    ).toEqual({
      kind: 'OWN',
      fromAccountId: ana.principal.id,
      toAccountId: ana.ahorro.id,
      beneficiaryId: null,
    });
  });

  it('TRF-06 un origen ajeno, un destino propio ajeno o un beneficiario ajeno responden 404', async () => {
    const luisBeneficiary = await addBeneficiary(t, luis, {
      name: 'Ana',
      alias: 'Ana',
      clabe: ana.principal.clabe,
    });
    expect(
      await codeOf(
        resolve(ana.userId, luis.principal.id, { type: 'OWN_ACCOUNT', id: ana.ahorro.id }),
      ),
    ).toBe('NOT_FOUND');
    expect(
      await codeOf(
        resolve(ana.userId, ana.principal.id, { type: 'OWN_ACCOUNT', id: luis.principal.id }),
      ),
    ).toBe('NOT_FOUND');
    expect(
      await codeOf(
        resolve(ana.userId, ana.principal.id, { type: 'BENEFICIARY', id: luisBeneficiary }),
      ),
    ).toBe('NOT_FOUND');
    expect(
      await codeOf(
        resolve(ana.userId, ana.principal.id, { type: 'BENEFICIARY', id: randomUUID() }),
      ),
    ).toBe('NOT_FOUND');
  });

  it('ACC-16 la Tesorería no puede ser origen ni destino', async () => {
    expect(
      await codeOf(
        resolve(ana.userId, ana.principal.id, { type: 'OWN_ACCOUNT', id: TREASURY_ACCOUNT_ID }),
      ),
    ).toBe('NOT_FOUND');
    expect(
      await codeOf(
        resolve(ana.userId, TREASURY_ACCOUNT_ID, { type: 'OWN_ACCOUNT', id: ana.ahorro.id }),
      ),
    ).toBe('NOT_FOUND');
  });

  it('TRF-07 la misma cuenta como origen y destino es SAME_ACCOUNT_TRANSFER', async () => {
    expect(
      await codeOf(
        resolve(ana.userId, ana.principal.id, { type: 'OWN_ACCOUNT', id: ana.principal.id }),
      ),
    ).toBe('SAME_ACCOUNT_TRANSFER');
  });
});
