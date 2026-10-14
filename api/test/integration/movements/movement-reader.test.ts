import { beforeEach, describe, expect, it } from 'vitest';
import type { MovementRecord } from '../../../src/modules/movements/application/ports.js';
import { PgMovementReader } from '../../../src/modules/movements/infrastructure/pg-movement-reader.js';
import { utcRangeOfDays } from '../../../src/shared/business-day.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;
let reader: PgMovementReader;

// 2026-09-30 18:00 CDMX.
const START = '2026-10-01T00:00:00.000Z';

beforeEach(async () => {
  t = await buildTestApp(harness, { now: START });
  reader = new PgMovementReader(harness.app);
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
});

async function send(
  from: LedgerUser,
  destination: Record<string, string>,
  amount: string,
  concept = 'Pago',
) {
  const res = await postTransfer(t, from, {
    fromAccountId: from.principal.id,
    destination,
    amount,
    concept,
    reference: '7',
  });
  expect(res.status).toBe(201);
  return res.body.id as string;
}

function page(accountId: string, overrides: Partial<Parameters<PgMovementReader['page']>[0]> = {}) {
  return reader.page({ accountId, types: [], limit: 100, ...overrides });
}

const summary = (rows: readonly MovementRecord[]) =>
  rows.map((row) => `${row.type} ${row.amountCents}`);

describe('HIS-03 contenido de cada movimiento', () => {
  it('HIS-03 cada tipo trae su contraparte: nula, alias, remitente o cuenta propia, con últimos 4 dígitos', async () => {
    await fund(t, ana.principal.id, '1000.00');
    const toLuis = await addBeneficiary(t, ana, {
      name: 'Luis Pérez',
      alias: 'Luis de la oficina',
      clabe: luis.principal.clabe,
    });
    t.clock.advance(1_000);
    const out = await send(ana, { type: 'BENEFICIARY', beneficiaryId: toLuis }, '150.00', 'Renta');
    t.clock.advance(1_000);
    await send(ana, { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id }, '200.00');

    const principal = await page(ana.principal.id);
    expect(principal.map((row) => [row.type, row.counterparty])).toEqual([
      ['OWN_TRANSFER_OUT', { name: 'Ahorro', clabeLast4: ana.ahorro.clabe.slice(-4) }],
      ['TRANSFER_OUT', { name: 'Luis de la oficina', clabeLast4: luis.principal.clabe.slice(-4) }],
      ['DEPOSIT', null],
    ]);
    expect(principal[1]).toMatchObject({
      amountCents: -15000n,
      balanceAfterCents: 85000n,
      transferId: out,
      concept: 'Renta',
      reference: 7,
      occurredAt: '2026-10-01T00:00:01.000000Z',
    });
    expect(principal[1]?.id).toMatch(/^[0-9]+$/);

    const ahorro = await page(ana.ahorro.id);
    expect(ahorro.map((row) => [row.type, row.amountCents, row.counterparty])).toEqual([
      ['OWN_TRANSFER_IN', 20000n, { name: 'Principal', clabeLast4: ana.principal.clabe.slice(-4) }],
    ]);
    const luisPrincipal = await page(luis.principal.id);
    expect(luisPrincipal.map((row) => [row.type, row.counterparty])).toEqual([
      ['TRANSFER_IN', { name: ana.person.fullName, clabeLast4: ana.principal.clabe.slice(-4) }],
    ]);
  });
});

describe('HIS-04 orden y keyset', () => {
  it('HIS-04 ordena por fecha y, en empate, por id, ambos descendentes, y respeta el límite pedido', async () => {
    await fund(t, ana.principal.id, '1000.00');
    // Mismo instante para todas: el desempate por id es el que decide el orden.
    for (let i = 1; i <= 4; i++) {
      await send(ana, { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id }, `${i}.00`);
    }
    const all = await page(ana.principal.id);
    expect(summary(all)).toEqual([
      'OWN_TRANSFER_OUT -400',
      'OWN_TRANSFER_OUT -300',
      'OWN_TRANSFER_OUT -200',
      'OWN_TRANSFER_OUT -100',
      'DEPOSIT 100000',
    ]);
    const ids = all.map((row) => BigInt(row.id));
    expect([...ids].sort((a, b) => (a > b ? -1 : 1))).toEqual(ids);
    expect(await page(ana.principal.id, { limit: 2 })).toEqual(all.slice(0, 2));
  });

  it('HIS-04 después de una posición devuelve solo lo anterior, sin repetirla, aunque compartan el instante', async () => {
    await fund(t, ana.principal.id, '1000.00');
    for (let i = 1; i <= 4; i++) {
      await send(ana, { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id }, `${i}.00`);
    }
    const all = await page(ana.principal.id);
    const second = all[1];
    if (!second) throw new Error('faltan movimientos');
    const rest = await page(ana.principal.id, {
      after: { occurredAt: second.occurredAt, id: second.id },
    });
    expect(rest).toEqual(all.slice(2));
  });
});

describe('HIS-06 y HIS-07 filtros', () => {
  it('HIS-06 un movimiento de las 23:30 del 2026-09-30 en CDMX entra en el día 2026-09-30 y no en el 2026-10-01', async () => {
    t.clock.set('2026-10-01T05:30:00.000Z'); // 23:30 CDMX del 30 de septiembre
    await fund(t, ana.principal.id, '1000.00');
    const sept30 = utcRangeOfDays('2026-09-30', '2026-09-30');
    const oct1 = utcRangeOfDays('2026-10-01', '2026-10-01');
    expect(
      summary(
        await page(ana.principal.id, { start: sept30.start, endExclusive: sept30.endExclusive }),
      ),
    ).toEqual(['DEPOSIT 100000']);
    expect(
      await page(ana.principal.id, { start: oct1.start, endExclusive: oct1.endExclusive }),
    ).toEqual([]);
  });

  it('HIS-07 con dos tipos devuelve solo esos tipos', async () => {
    await fund(t, ana.principal.id, '1000.00');
    await fund(t, luis.principal.id, '1000.00');
    const toAna = await addBeneficiary(t, luis, {
      name: 'Ana',
      alias: 'Ana',
      clabe: ana.principal.clabe,
    });
    await send(luis, { type: 'BENEFICIARY', beneficiaryId: toAna }, '50.00');
    await send(ana, { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id }, '10.00');
    const rows = await page(ana.principal.id, { types: ['TRANSFER_IN', 'DEPOSIT'] });
    expect(summary(rows)).toEqual(['TRANSFER_IN 5000', 'DEPOSIT 100000']);
  });

  it('HIS-01 solo devuelve los asientos de la cuenta pedida', async () => {
    await fund(t, ana.principal.id, '1000.00');
    await fund(t, luis.principal.id, '500.00');
    expect(summary(await page(luis.principal.id))).toEqual(['DEPOSIT 50000']);
    expect(await page(ana.ahorro.id)).toEqual([]);
  });
});
