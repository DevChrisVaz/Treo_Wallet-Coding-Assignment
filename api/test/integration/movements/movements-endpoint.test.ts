import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { authed, fund, ledgerUser, type LedgerUser } from '../../helpers/ledger-api.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;

beforeEach(async () => {
  t = await buildTestApp(harness);
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
});

async function movements(user: LedgerUser, accountId: string, query = '') {
  const res = await authed(t, user.accessToken).get(`/accounts/${accountId}/movements${query}`);
  expectToMatchContract(res, 'listAccountMovements');
  return res;
}

describe('HIS-01 historial de una cuenta propia', () => {
  it('HIS-01 responde 200 con la página de movimientos de la cuenta', async () => {
    await fund(t, ana.principal.id, '1000.00');
    const res = await movements(ana, ana.principal.id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: [
        {
          id: expect.stringMatching(/^[0-9]+$/),
          type: 'DEPOSIT',
          amount: '1000.00',
          balanceAfter: '1000.00',
          concept: 'Fondeo de la Tesorería',
          reference: null,
          counterparty: null,
          transferId: expect.any(String),
          occurredAt: '2026-10-13T18:00:00.000Z',
        },
      ],
      nextCursor: null,
    });
  });

  it('HIS-01 Ana consulta una cuenta de Luis: 404 NOT_FOUND', async () => {
    await fund(t, luis.principal.id, '1000.00');
    const res = await movements(ana, luis.principal.id);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('HIS-01 una cuenta inexistente, la Tesorería o un id mal formado responden 404', async () => {
    expect((await movements(ana, '00000000-0000-4000-8000-000000000000')).status).toBe(404);
    expect((await movements(ana, '00000000-0000-0000-0000-000000000001')).status).toBe(404);
    expect((await movements(ana, 'no-es-uuid')).status).toBe(404);
  });
});

describe('HIS-08 últimos movimientos y paginación', () => {
  it('HIS-08 sin filtros devuelve los 20 más recientes y un cursor que lleva a los siguientes', async () => {
    for (let i = 1; i <= 25; i++) {
      t.clock.advance(1_000);
      await fund(t, ana.principal.id, `${i}.00`);
    }
    const first = await movements(ana, ana.principal.id);
    expect(first.body.items).toHaveLength(20);
    expect(first.body.items[0].amount).toBe('25.00');
    expect(first.body.items[19].amount).toBe('6.00');
    expect(first.body.nextCursor).toEqual(expect.any(String));
    const second = await movements(
      ana,
      ana.principal.id,
      `?cursor=${encodeURIComponent(first.body.nextCursor)}`,
    );
    expect(second.body.items.map((m: { amount: string }) => m.amount)).toEqual([
      '5.00',
      '4.00',
      '3.00',
      '2.00',
      '1.00',
    ]);
    expect(second.body.nextCursor).toBeNull();
  });

  it('HIS-05 un cursor alterado responde 400 INVALID_CURSOR y limit 101 responde 422', async () => {
    await fund(t, ana.principal.id, '1.00');
    await fund(t, ana.principal.id, '2.00');
    const first = await movements(ana, ana.principal.id, '?limit=1');
    const cursor: string = first.body.nextCursor;
    const altered = `${cursor.slice(0, 5)}${cursor[5] === 'A' ? 'B' : 'A'}${cursor.slice(6)}`;
    const bad = await movements(ana, ana.principal.id, `?limit=1&cursor=${altered}`);
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('INVALID_CURSOR');
    const tooMany = await movements(ana, ana.principal.id, '?limit=101');
    expect(tooMany.status).toBe(422);
    expect(tooMany.body.code).toBe('VALIDATION_FAILED');
  });
});
