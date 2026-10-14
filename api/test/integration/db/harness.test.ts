import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { useIntegrationHarness } from '../../helpers/harness.js';

const harness = useIntegrationHarness();

async function counts() {
  const [row] = await harness.migrator.query(
    `SELECT (SELECT count(*) FROM app.users)::int AS users,
            (SELECT count(*) FROM app.audit_log)::int AS events,
            (SELECT count(*) FROM app.accounts WHERE type = 'USER')::int AS user_accounts`,
  );
  return row as { users: number; events: number; user_accounts: number };
}

describe('PLT-13 arnés de integración', () => {
  it('PLT-13 el código bajo prueba usa el rol de ejecución', async () => {
    const [row] = await harness.app.query('SELECT current_user AS role');
    expect(row.role).toBe('wallet_app');
    const [owner] = await harness.migrator.query('SELECT current_user AS role');
    expect(owner.role).toBe('wallet_migrator');
  });

  it('PLT-13 deja datos de una prueba…', async () => {
    await harness.app.query(
      `INSERT INTO users (id, email, password_hash, full_name, curp, rfc, phone)
       VALUES ($1, 'harness@example.com', 'h', 'Arnés', 'HARN900101HDFNLR09', 'HARN900101AB1',
               '+525500000001')`,
      [randomUUID()],
    );
    await harness.app.query(
      `INSERT INTO audit_log (actor_type, action) VALUES ('SYSTEM', 'LOGOUT')`,
    );
    expect(await counts()).toMatchObject({ users: 1, events: 1 });
  });

  it('PLT-13 …que la siguiente ya no ve, con la Tesorería recreada', async () => {
    expect(await counts()).toEqual({ users: 0, events: 0, user_accounts: 0 });
    const treasury = await harness.migrator.query(
      `SELECT name, balance_cents FROM app.accounts WHERE type = 'SYSTEM'`,
    );
    expect(treasury).toEqual([{ name: 'Tesorería', balance_cents: '0' }]);
  });

  it('PLT-13 el reinicio vuelve a activar los triggers de protección', async () => {
    await expect(harness.migrator.query('TRUNCATE app.audit_log')).rejects.toThrow(
      /solo inserción/,
    );
  });
});
