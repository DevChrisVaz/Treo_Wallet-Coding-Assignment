import { describe, expect, it } from 'vitest';
import { TREASURY_ACCOUNT_ID } from '../../../migrations/1760400002000-accounts.js';
import { Money } from '../../../src/shared/money.js';
import { auditEvents } from '../../helpers/audit.js';
import { buildTestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { insertUserWithAccounts } from '../../helpers/ledger-fixtures.js';

const harness = useIntegrationHarness();

async function balance(accountId: string): Promise<string> {
  const [row] = await harness.migrator.query(
    'SELECT balance_cents FROM app.accounts WHERE id = $1',
    [accountId],
  );
  return row.balance_cents;
}

describe('ACC-15 fondeo desde la Tesorería', () => {
  it('ACC-15 deposita en la cuenta, descuenta de la Tesorería y audita FUNDING_POSTED como SYSTEM', async () => {
    const t = await buildTestApp(harness);
    const ana = await insertUserWithAccounts(harness.migrator);
    const result = await t.container.ledger.fundAccount.execute({
      account: ana.principalId,
      amount: Money.parse('1000.00'),
    });
    expect(result.balanceAfter.toDecimalString()).toBe('1000.00');
    expect(await balance(ana.principalId)).toBe('100000');
    expect(await balance(TREASURY_ACCOUNT_ID)).toBe('-100000');
    const [entry] = await harness.migrator.query(
      `SELECT type, amount_cents FROM app.ledger_entries WHERE account_id = $1`,
      [ana.principalId],
    );
    expect(entry).toEqual({ type: 'DEPOSIT', amount_cents: '100000' });
    const [transfer] = await harness.migrator.query(
      `SELECT kind, status, user_id FROM app.transfers WHERE id = $1`,
      [result.transferId],
    );
    expect(transfer).toEqual({ kind: 'FUNDING', status: 'COMPLETED', user_id: null });
    expect(await auditEvents(harness.migrator)).toMatchObject([
      {
        action: 'FUNDING_POSTED',
        actor_type: 'SYSTEM',
        entity_id: result.transferId,
        metadata: { amount: '1000.00', accountId: ana.principalId },
      },
    ]);
  });

  it('ACC-15 también encuentra la cuenta por su CLABE', async () => {
    const t = await buildTestApp(harness);
    const ana = await insertUserWithAccounts(harness.migrator);
    await t.container.ledger.fundAccount.execute({
      account: ana.ahorroClabe,
      amount: Money.parse('25.50'),
    });
    expect(await balance(ana.ahorroId)).toBe('2550');
  });

  it('ACC-16 no fondea a la Tesorería ni a una cuenta inexistente y no escribe asientos', async () => {
    const t = await buildTestApp(harness);
    for (const account of [
      TREASURY_ACCOUNT_ID,
      '00000000-0000-4000-8000-000000000999',
      '999180000000000000',
    ]) {
      await expect(
        t.container.ledger.fundAccount.execute({ account, amount: Money.parse('1.00') }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    }
    const [{ n }] = await harness.migrator.query(
      'SELECT count(*)::int AS n FROM app.ledger_entries',
    );
    expect(n).toBe(0);
  });
});
