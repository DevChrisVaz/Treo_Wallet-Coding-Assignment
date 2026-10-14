import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { authed, ledgerUser, type LedgerUser } from '../../helpers/ledger-api.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;

beforeEach(async () => {
  t = await buildTestApp(harness);
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
});

describe('BEN-01 y BEN-09 endpoints de beneficiarios', () => {
  it('BEN-01 POST /beneficiaries responde 201 con el beneficiario y luego aparece en el listado', async () => {
    const body = { name: 'Luis Pérez', alias: 'Luis', clabe: luis.principal.clabe };
    const created = await authed(t, ana.accessToken).post('/beneficiaries').send(body);
    expectToMatchContract(created, 'createBeneficiary');
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      ...body,
      id: expect.any(String),
      createdAt: expect.any(String),
    });

    const list = await authed(t, ana.accessToken).get('/beneficiaries');
    expectToMatchContract(list, 'listBeneficiaries');
    expect(list.body.items).toEqual([created.body]);
  });

  it('BEN-07 el reintento idéntico responde 200 con el mismo id', async () => {
    const body = { name: 'Luis Pérez', alias: 'Luis', clabe: luis.principal.clabe };
    const first = await authed(t, ana.accessToken).post('/beneficiaries').send(body);
    const again = await authed(t, ana.accessToken).post('/beneficiaries').send(body);
    expectToMatchContract(again, 'createBeneficiary');
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(first.body.id);
  });

  it('BEN-09 el listado va ordenado por alias', async () => {
    for (const [alias, clabe] of [
      ['Zeta', luis.principal.clabe],
      ['Ahorro de Luis', luis.ahorro.clabe],
    ] as const) {
      await authed(t, ana.accessToken).post('/beneficiaries').send({ name: 'Luis', alias, clabe });
    }
    const list = await authed(t, ana.accessToken).get('/beneficiaries');
    expect(list.body.items.map((item: { alias: string }) => item.alias)).toEqual([
      'Ahorro de Luis',
      'Zeta',
    ]);
  });

  it('BEN-10 el undécimo intento de alta en una hora responde 429 con Retry-After', async () => {
    for (let i = 0; i < 10; i += 1) {
      const res = await authed(t, ana.accessToken)
        .post('/beneficiaries')
        .send({ name: 'Luis', alias: `Luis ${i}`, clabe: '032180000118359719' });
      expect(res.status).toBe(422);
    }
    const eleventh = await authed(t, ana.accessToken)
      .post('/beneficiaries')
      .send({ name: 'Luis', alias: 'Luis', clabe: luis.principal.clabe });
    expectToMatchContract(eleventh, 'createBeneficiary');
    expect(eleventh.status).toBe(429);
    expect(eleventh.body.code).toBe('RATE_LIMITED');
    expect(eleventh.headers['retry-after']).toBeDefined();
    // El límite es por usuario: Luis no se ve afectado.
    const other = await authed(t, luis.accessToken)
      .post('/beneficiaries')
      .send({ name: 'Ana', alias: 'Ana', clabe: ana.principal.clabe });
    expect(other.status).toBe(201);
  });
});
