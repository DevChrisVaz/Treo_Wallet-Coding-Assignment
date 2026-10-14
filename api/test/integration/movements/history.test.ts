import { describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  authed,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';

const harness = useIntegrationHarness();

interface Scene {
  readonly t: TestApp;
  readonly ana: LedgerUser;
  readonly luis: LedgerUser;
  readonly beneficiaryId: string;
}

async function scene(now = '2026-10-13T18:00:00.000Z'): Promise<Scene> {
  const t = await buildTestApp(harness, { now });
  const ana = await ledgerUser(t, harness);
  const luis = await ledgerUser(t, harness);
  const beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
  return { t, ana, luis, beneficiaryId };
}

async function movements(s: Scene, user: LedgerUser, accountId: string, query = '') {
  const res = await authed(s.t, user.accessToken).get(`/accounts/${accountId}/movements${query}`);
  expectToMatchContract(res, 'listAccountMovements');
  return res;
}

interface MovementBody {
  id: string;
  type: string;
  amount: string;
  balanceAfter: string;
  counterparty: { name: string; clabeLast4: string | null } | null;
  transferId: string;
  occurredAt: string;
}

const items = (res: { body: { items: MovementBody[] } }) => res.body.items;

describe('HIS-01 y HIS-02 qué cuentas y qué movimientos', () => {
  it('HIS-01 Ana consulta los movimientos de una cuenta de Luis: 404 NOT_FOUND', async () => {
    const s = await scene();
    await fund(s.t, s.luis.principal.id, '100.00');
    const res = await movements(s, s.ana, s.luis.principal.id);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('HIS-02 las transferencias rechazadas y pendientes de OTP no aparecen en el historial', async () => {
    const s = await scene();
    await fund(s.t, s.ana.principal.id, '12000.00');
    const toLuis = (amount: string) => ({
      fromAccountId: s.ana.principal.id,
      destination: { type: 'BENEFICIARY', beneficiaryId: s.beneficiaryId },
      amount,
      concept: 'Pago',
      reference: '1',
    });
    const rejected = await postTransfer(s.t, s.ana, toLuis('50000.00'));
    expect(rejected.status).toBe(422);
    const pending = await postTransfer(s.t, s.ana, toLuis('11000.00'));
    expect(pending.body.status).toBe('PENDING_OTP');
    const res = await movements(s, s.ana, s.ana.principal.id);
    expect(items(res).map((m) => m.type)).toEqual(['DEPOSIT']);
    expect(items(res).map((m) => m.transferId)).not.toContain(rejected.body.transferId);
    expect(items(res).map((m) => m.transferId)).not.toContain(pending.body.id);
    expect(items(await movements(s, s.luis, s.luis.principal.id))).toEqual([]);
  });
});

describe('HIS-03 contenido de los movimientos', () => {
  it('HIS-03 150.00 a "Luis" desde 1000.00: TRANSFER_OUT de "-150.00", balanceAfter "850.00" y contraparte "Luis"', async () => {
    const s = await scene();
    await fund(s.t, s.ana.principal.id, '1000.00');
    s.t.clock.advance(1_000);
    const sent = await postTransfer(s.t, s.ana, {
      fromAccountId: s.ana.principal.id,
      destination: { type: 'BENEFICIARY', beneficiaryId: s.beneficiaryId },
      amount: '150.00',
      concept: 'Renta',
      reference: '1234567',
    });
    const [latest] = items(await movements(s, s.ana, s.ana.principal.id));
    expect(latest).toEqual({
      id: expect.any(String),
      type: 'TRANSFER_OUT',
      amount: '-150.00',
      balanceAfter: '850.00',
      concept: 'Renta',
      reference: '1234567',
      counterparty: { name: 'Luis', clabeLast4: s.luis.principal.clabe.slice(-4) },
      transferId: sent.body.id,
      occurredAt: '2026-10-13T18:00:01.000Z',
    });
    const [received] = items(await movements(s, s.luis, s.luis.principal.id));
    expect(received).toMatchObject({
      type: 'TRANSFER_IN',
      amount: '150.00',
      balanceAfter: '150.00',
      counterparty: { name: s.ana.person.fullName, clabeLast4: s.ana.principal.clabe.slice(-4) },
    });
  });

  it('HIS-03 500.00 de "Principal" a "Ahorro" aparece en ambas cuentas', async () => {
    const s = await scene();
    await fund(s.t, s.ana.principal.id, '1000.00');
    await postTransfer(s.t, s.ana, {
      fromAccountId: s.ana.principal.id,
      destination: { type: 'OWN_ACCOUNT', accountId: s.ana.ahorro.id },
      amount: '500.00',
      concept: 'Ahorro',
      reference: '1',
    });
    const [out] = items(await movements(s, s.ana, s.ana.principal.id));
    const [into] = items(await movements(s, s.ana, s.ana.ahorro.id));
    expect(out).toMatchObject({
      type: 'OWN_TRANSFER_OUT',
      amount: '-500.00',
      counterparty: { name: 'Ahorro' },
    });
    expect(into).toMatchObject({
      type: 'OWN_TRANSFER_IN',
      amount: '500.00',
      balanceAfter: '500.00',
      counterparty: { name: 'Principal' },
    });
    expect(out?.transferId).toBe(into?.transferId);
  });

  it('HIS-03 un fondeo de la Tesorería es DEPOSIT con counterparty nulo', async () => {
    const s = await scene();
    await fund(s.t, s.ana.principal.id, '250.00');
    expect(items(await movements(s, s.ana, s.ana.principal.id))).toEqual([
      expect.objectContaining({ type: 'DEPOSIT', amount: '250.00', counterparty: null }),
    ]);
  });
});

describe('HIS-04 y HIS-05 paginación por cursor', () => {
  async function walk(s: Scene, query: string) {
    const pages: MovementBody[][] = [];
    let cursor: string | null = null;
    do {
      const suffix: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      const res = await movements(s, s.ana, s.ana.principal.id, `${query}${suffix}`);
      expect(res.status).toBe(200);
      pages.push(items(res));
      cursor = res.body.nextCursor;
    } while (cursor);
    return pages;
  }

  it('HIS-04 45 movimientos con limit 20 dan 3 páginas de 20, 20 y 5 sin repetidos ni faltantes', async () => {
    const s = await scene();
    for (let i = 1; i <= 45; i++) {
      // Varios comparten instante: el desempate por id también se recorre.
      if (i % 3 === 0) s.t.clock.advance(1_000);
      await fund(s.t, s.ana.principal.id, `${i}.00`);
    }
    const pages = await walk(s, '?limit=20');
    expect(pages.map((page) => page.length)).toEqual([20, 20, 5]);
    const amounts = pages.flat().map((m) => m.amount);
    expect(amounts).toEqual(Array.from({ length: 45 }, (_, i) => `${45 - i}.00`));
    expect(new Set(pages.flat().map((m) => m.id)).size).toBe(45);
  });

  it('HIS-04 un movimiento nuevo entre la primera y la segunda página no se repite ni se omite nada', async () => {
    const s = await scene();
    for (let i = 1; i <= 6; i++) {
      s.t.clock.advance(1_000);
      await fund(s.t, s.ana.principal.id, `${i}.00`);
    }
    const first = await movements(s, s.ana, s.ana.principal.id, '?limit=3');
    s.t.clock.advance(1_000);
    await fund(s.t, s.ana.principal.id, '99.00');
    const second = await movements(
      s,
      s.ana,
      s.ana.principal.id,
      `?limit=3&cursor=${encodeURIComponent(first.body.nextCursor)}`,
    );
    expect(items(first).map((m) => m.amount)).toEqual(['6.00', '5.00', '4.00']);
    expect(items(second).map((m) => m.amount)).toEqual(['3.00', '2.00', '1.00']);
    expect(second.body.nextCursor).toBeNull();
  });

  it('HIS-04 limit 101 responde 422 VALIDATION_FAILED', async () => {
    const s = await scene();
    const res = await movements(s, s.ana, s.ana.principal.id, '?limit=101');
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'VALIDATION_FAILED', errors: [{ pointer: '/limit' }] });
  });

  it('HIS-05 un cursor obtenido con TRANSFER_OUT usado con DEPOSIT responde 400 INVALID_CURSOR', async () => {
    const s = await scene();
    await fund(s.t, s.ana.principal.id, '100.00');
    for (let i = 1; i <= 3; i++) {
      await postTransfer(s.t, s.ana, {
        fromAccountId: s.ana.principal.id,
        destination: { type: 'BENEFICIARY', beneficiaryId: s.beneficiaryId },
        amount: '1.00',
        concept: 'Pago',
        reference: String(i),
      });
    }
    const first = await movements(s, s.ana, s.ana.principal.id, '?type=TRANSFER_OUT&limit=1');
    const cursor = encodeURIComponent(first.body.nextCursor);
    const same = await movements(
      s,
      s.ana,
      s.ana.principal.id,
      `?type=TRANSFER_OUT&limit=1&cursor=${cursor}`,
    );
    expect(same.status).toBe(200);
    const other = await movements(
      s,
      s.ana,
      s.ana.principal.id,
      `?type=DEPOSIT&limit=1&cursor=${cursor}`,
    );
    expect(other.status).toBe(400);
    expect(other.body.code).toBe('INVALID_CURSOR');
  });
});

describe('HIS-06 a HIS-08 filtros y últimos movimientos', () => {
  it('HIS-06 un movimiento de las 23:30 del 2026-09-30 en CDMX aparece filtrando ese día', async () => {
    const s = await scene('2026-10-01T05:30:00.000Z'); // 23:30 CDMX del 30 de septiembre
    await fund(s.t, s.ana.principal.id, '100.00');
    const day = await movements(s, s.ana, s.ana.principal.id, '?from=2026-09-30&to=2026-09-30');
    expect(items(day).map((m) => m.occurredAt)).toEqual(['2026-10-01T05:30:00.000Z']);
    const next = await movements(s, s.ana, s.ana.principal.id, '?from=2026-10-01&to=2026-10-01');
    expect(items(next)).toEqual([]);
  });

  it('HIS-06 from 2026-10-10 con to 2026-10-01 responde 422 VALIDATION_FAILED', async () => {
    const s = await scene();
    const res = await movements(s, s.ana, s.ana.principal.id, '?from=2026-10-10&to=2026-10-01');
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('HIS-07 type=TRANSFER_IN&type=DEPOSIT devuelve solo esos tipos', async () => {
    const s = await scene();
    await fund(s.t, s.ana.principal.id, '1000.00');
    await fund(s.t, s.luis.principal.id, '1000.00');
    const toAna = await addBeneficiary(s.t, s.luis, {
      name: 'Ana',
      alias: 'Ana',
      clabe: s.ana.principal.clabe,
    });
    await postTransfer(s.t, s.luis, {
      fromAccountId: s.luis.principal.id,
      destination: { type: 'BENEFICIARY', beneficiaryId: toAna },
      amount: '40.00',
      concept: 'Pago',
      reference: '1',
    });
    for (const [type, amount] of [
      ['BENEFICIARY', '10.00'],
      ['OWN_ACCOUNT', '20.00'],
    ] as const) {
      await postTransfer(s.t, s.ana, {
        fromAccountId: s.ana.principal.id,
        destination:
          type === 'BENEFICIARY'
            ? { type, beneficiaryId: s.beneficiaryId }
            : { type, accountId: s.ana.ahorro.id },
        amount,
        concept: 'Pago',
        reference: '2',
      });
    }
    const all = await movements(s, s.ana, s.ana.principal.id);
    expect(new Set(items(all).map((m) => m.type))).toEqual(
      new Set(['DEPOSIT', 'TRANSFER_IN', 'TRANSFER_OUT', 'OWN_TRANSFER_OUT']),
    );
    const two = await movements(s, s.ana, s.ana.principal.id, '?type=TRANSFER_IN&type=DEPOSIT');
    expect(items(two).map((m) => m.type)).toEqual(['TRANSFER_IN', 'DEPOSIT']);
  });

  it('HIS-08 sin filtros devuelve los 20 más recientes en orden descendente', async () => {
    const s = await scene();
    for (let i = 1; i <= 30; i++) {
      // Un segundo entre fondeos: avanzar más vencería el access token (10 minutos).
      s.t.clock.advance(1_000);
      await fund(s.t, s.ana.principal.id, `${i}.00`);
    }
    const res = await movements(s, s.ana, s.ana.principal.id, '?limit=20');
    const dates = items(res).map((m) => m.occurredAt);
    expect(items(res).map((m) => m.amount)).toEqual(
      Array.from({ length: 20 }, (_, i) => `${30 - i}.00`),
    );
    expect([...dates].sort().reverse()).toEqual(dates);
  });
});
