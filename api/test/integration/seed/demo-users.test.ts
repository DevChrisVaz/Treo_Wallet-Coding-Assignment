import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_USERS, seedDemoUsers } from '../../../src/seed/demo-users.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';

const harness = useIntegrationHarness();
let t: TestApp;

beforeEach(async () => {
  t = await buildTestApp(harness);
});

const clabe = { bankCode: '999', plazaCode: '180' };

async function counts() {
  const [row] = await harness.migrator.query(
    `SELECT (SELECT count(*) FROM app.users WHERE email_verified_at IS NOT NULL)::int AS users,
            (SELECT count(*) FROM app.accounts WHERE type = 'USER')::int AS accounts`,
  );
  return row as { users: number; accounts: number };
}

describe('PLT-13 seed de usuarios demo', () => {
  it('PLT-13 crea a Ana y a Luis verificados, cada uno con "Principal" y "Ahorro"', async () => {
    await seedDemoUsers(harness.migrator, { clabe });
    expect(await counts()).toEqual({ users: 2, accounts: 4 });
    const rows = await harness.migrator.query(
      `SELECT u.email, array_agg(a.name ORDER BY a.name) AS accounts
         FROM app.users u JOIN app.accounts a ON a.user_id = u.id GROUP BY u.email ORDER BY u.email`,
    );
    expect(rows).toEqual([
      { email: 'ana@example.com', accounts: ['Ahorro', 'Principal'] },
      { email: 'luis@example.com', accounts: ['Ahorro', 'Principal'] },
    ]);
  });

  it('PLT-13 es idempotente: correrlo dos veces no duplica nada', async () => {
    await seedDemoUsers(harness.migrator, { clabe });
    await seedDemoUsers(harness.migrator, { clabe });
    expect(await counts()).toEqual({ users: 2, accounts: 4 });
  });

  it('PLT-13 las credenciales demo documentadas inician sesión en la API', async () => {
    await seedDemoUsers(harness.migrator, { clabe });
    for (const user of DEMO_USERS) {
      const res = await request(t.app)
        .post('/auth/login')
        .send({ email: user.email, password: user.password });
      expect(res.status, user.email).toBe(200);
    }
  });
});
