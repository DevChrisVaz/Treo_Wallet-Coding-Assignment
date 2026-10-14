import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { TREASURY_ACCOUNT_ID } from '../../../migrations/1760400002000-accounts.js';
import { Money } from '../../../src/shared/money.js';
import { buildTestApp } from '../../helpers/app.js';
import { contract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { verifiedUser } from '../../helpers/identity.js';
import { insertUserWithAccounts } from '../../helpers/ledger-fixtures.js';
import { reconcile, RECONCILED } from '../../helpers/reconciliation.js';

const harness = useIntegrationHarness();

describe('ACC-15 la Tesorería y el fondeo', () => {
  it('ACC-15 varios fondeos dejan la Tesorería en negativo sin violar constraints y todo concilia', async () => {
    const t = await buildTestApp(harness);
    const ana = await insertUserWithAccounts(harness.migrator);
    const luis = await insertUserWithAccounts(harness.migrator);
    for (const [account, amount] of [
      [ana.principalId, '5000.00'],
      [ana.ahorroId, '0.01'],
      [luis.principalId, '999999999999.99'],
    ] as const) {
      await t.container.ledger.fundAccount.execute({ account, amount: Money.parse(amount) });
    }
    const [{ balance_cents }] = await harness.migrator.query(
      'SELECT balance_cents FROM app.accounts WHERE id = $1',
      [TREASURY_ACCOUNT_ID],
    );
    // 5000.00 + 0.01 + 999999999999.99 = 1000000005000.00
    expect(balance_cents).toBe('-100000000500000');
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });

  it('ACC-15 ninguna operación del contrato crea dinero y la API no expone una ruta de depósito', async () => {
    const operations = Object.values(contract.paths).flatMap((methods) =>
      Object.values(methods).map((operation) => String(operation.operationId)),
    );
    expect(operations.filter((id) => /fund|deposit/i.test(id))).toEqual([]);

    const t = await buildTestApp(harness);
    const user = await verifiedUser(t);
    for (const path of ['/funding', '/fund', '/deposits', '/accounts/fund', '/admin/fund']) {
      const res = await request(t.app)
        .post(path)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ amount: '1000.00' });
      expect(res.status, path).toBe(404);
    }
  });
});
