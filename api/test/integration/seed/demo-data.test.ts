import { describe, expect, it } from 'vitest';
import { validateCurp } from '../../../src/modules/identity/domain/curp.js';
import { validateRfc } from '../../../src/modules/identity/domain/rfc.js';
import { seedDemoData } from '../../../src/seed/demo-data.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { reconcile, RECONCILED } from '../../helpers/reconciliation.js';

const harness = useIntegrationHarness();
const options = {
  clabe: { bankCode: '999', plazaCode: '180' },
  generatedUsers: 3,
  fundedAt: new Date('2025-10-11T15:00:00.000Z'),
};

describe('HIS-10 datos demo del seed', () => {
  it('HIS-10 crea a Ana, a Luis y a los usuarios generados verificados, con datos sintéticos válidos y dos cuentas', async () => {
    const data = await seedDemoData(harness.migrator, options);
    expect(data.others).toHaveLength(4);
    const users: { email: string; curp: string; rfc: string; phone: string; verified: boolean }[] =
      await harness.migrator.query(
        `SELECT email, curp, rfc, phone, email_verified_at IS NOT NULL AS verified
           FROM app.users ORDER BY email`,
      );
    expect(users).toHaveLength(5);
    for (const user of users) {
      expect(user.verified).toBe(true);
      expect(validateCurp(user.curp), user.curp).toBe('VALID');
      expect(validateRfc(user.rfc), user.rfc).toBe('VALID');
      expect(user.phone).toMatch(/^\+52[0-9]{10}$/);
    }
    const accounts = await harness.migrator.query(
      `SELECT user_id, array_agg(name ORDER BY name) AS names FROM app.accounts
        WHERE type = 'USER' GROUP BY user_id`,
    );
    expect(accounts).toHaveLength(5);
    expect(accounts.every((a: { names: string[] }) => a.names.join() === 'Ahorro,Principal')).toBe(
      true,
    );
  });

  it('BEN-01 Ana ya tiene registrado a Luis (y a otros) y cada usuario tiene a Ana como beneficiaria', async () => {
    const data = await seedDemoData(harness.migrator, options);
    const luis = data.others.find((user) => user.email === 'luis@example.com');
    const anaBeneficiaries = await harness.migrator.query(
      `SELECT alias, clabe, account_id FROM app.beneficiaries WHERE user_id = $1 ORDER BY alias`,
      [data.ana.userId],
    );
    expect(anaBeneficiaries).toContainEqual({
      alias: 'Luis',
      clabe: luis?.principal.clabe,
      account_id: luis?.principal.id,
    });
    expect(anaBeneficiaries.length).toBeGreaterThan(1);
    const toAna = await harness.migrator.query(
      `SELECT count(*)::int AS n FROM app.beneficiaries WHERE account_id = $1 AND alias = 'Ana'`,
      [data.ana.principal.id],
    );
    expect(toAna[0].n).toBe(4);
  });

  it('ACC-15 fondea cada "Principal" desde la Tesorería con FUNDING_POSTED y la fecha indicada', async () => {
    const data = await seedDemoData(harness.migrator, options);
    const deposits = await harness.migrator.query(
      `SELECT a.user_id, e.amount_cents, e.created_at FROM app.ledger_entries e
         JOIN app.accounts a ON a.id = e.account_id
        WHERE e.type = 'DEPOSIT' ORDER BY e.amount_cents`,
    );
    expect(deposits).toHaveLength(5);
    expect(deposits[0]).toMatchObject({ user_id: data.ana.userId, amount_cents: '1000000' });
    expect(
      deposits.slice(1).every((d: { amount_cents: string }) => d.amount_cents === '60000000'),
    ).toBe(true);
    expect(
      deposits.every(
        (d: { created_at: Date }) => d.created_at.getTime() === options.fundedAt.getTime(),
      ),
    ).toBe(true);
    const [{ n }] = await harness.migrator.query(
      `SELECT count(*)::int AS n FROM app.audit_log WHERE action = 'FUNDING_POSTED' AND actor_type = 'SYSTEM'`,
    );
    expect(n).toBe(5);
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });

  it('HIS-10 es idempotente: correrlo dos veces no duplica usuarios, beneficiarios ni fondeos', async () => {
    await seedDemoData(harness.migrator, options);
    await seedDemoData(harness.migrator, options);
    const [counts] = await harness.migrator.query(
      `SELECT (SELECT count(*) FROM app.users)::int AS users,
              (SELECT count(*) FROM app.beneficiaries)::int AS beneficiaries,
              (SELECT count(*) FROM app.transfers WHERE kind = 'FUNDING')::int AS fundings`,
    );
    expect(counts.users).toBe(5);
    expect(counts.fundings).toBe(5);
    const [{ n }] = await harness.migrator.query(
      'SELECT count(*)::int AS n FROM app.beneficiaries',
    );
    expect(counts.beneficiaries).toBe(n);
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);
  });
});
