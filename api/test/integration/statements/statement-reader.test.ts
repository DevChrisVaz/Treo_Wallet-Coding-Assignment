import { beforeEach, describe, expect, it } from 'vitest';
import type { AuditWriter } from '../../../src/modules/audit/application/audit-writer.js';
import type { MovementRecord } from '../../../src/modules/movements/application/ports.js';
import { GenerateStatement } from '../../../src/modules/statements/application/generate-statement.js';
import type {
  StatementReader,
  StatementRenderer,
  StatementSnapshot,
} from '../../../src/modules/statements/application/ports.js';
import type { ReconciledSummary } from '../../../src/modules/statements/domain/statement-summary.js';
import { StatementPeriod } from '../../../src/modules/statements/domain/statement-period.js';
import { PgStatementReader } from '../../../src/modules/statements/infrastructure/pg-statement-reader.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { FakeClock } from '../../helpers/fake-clock.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { captureLogger } from '../../helpers/logs.js';
import {
  addBeneficiary,
  confirmTransfer,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;

beforeEach(async () => {
  // 31 de agosto de 2026, 23:58 en CDMX: a 2 minutos de septiembre.
  t = await buildTestApp(harness, { now: '2026-09-01T05:58:00.000Z' });
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
});

const FAR_FUTURE = new Date('2099-01-01T00:00:00.000Z');
const EPOCH = new Date('2000-01-01T00:00:00.000Z');

async function send(from: LedgerUser, destination: Record<string, string>, amount: string) {
  const res = await postTransfer(t, from, {
    fromAccountId: from.principal.id,
    destination,
    amount,
    concept: 'Pago',
    reference: '1',
  });
  expect(res.status).toBe(201);
  return res.body as { id: string; status: string };
}

async function collect(batches: AsyncIterable<readonly MovementRecord[]>) {
  const sizes: number[] = [];
  const rows: MovementRecord[] = [];
  for await (const batch of batches) {
    sizes.push(batch.length);
    rows.push(...batch);
  }
  return { sizes, rows };
}

function period(value: string, now = '2026-10-14T18:00:00.000Z') {
  return StatementPeriod.parse(value, new FakeClock(now));
}

describe('HIS-12 lector del estado de cuenta', () => {
  it('HIS-12 la cuenta se lee solo si es del usuario, con el nombre del titular y la CLABE completa', async () => {
    const reader = new PgStatementReader(harness.app);
    const result = await reader.withSnapshot(async (snapshot) => ({
      own: await snapshot.account(ana.userId, ana.principal.id),
      foreign: await snapshot.account(ana.userId, luis.principal.id),
    }));
    expect(result.own).toEqual({
      id: ana.principal.id,
      name: 'Principal',
      clabe: ana.principal.clabe,
      holderName: ana.person.fullName,
      createdAt: expect.any(Date),
    });
    expect(result.foreign).toBeNull();
  });

  it('HIS-12 la Tesorería no es la cuenta de nadie', async () => {
    const [{ id }] = await harness.migrator.query(
      `SELECT id FROM app.accounts WHERE type = 'SYSTEM'`,
    );
    const reader = new PgStatementReader(harness.app);
    expect(await reader.withSnapshot((s) => s.account(ana.userId, id as string))).toBeNull();
  });

  it('HIS-12 el saldo inicial es el balanceAfter del último asiento anterior al periodo, o 0 sin asientos', async () => {
    await fund(t, ana.principal.id, '1000.00'); // 31 de agosto
    t.clock.advance(3 * 60_000); // 1 de septiembre, 00:01 en CDMX
    await send(ana, { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id }, '150.00');
    const september = period('2026-09');
    const reader = new PgStatementReader(harness.app);
    const opening = await reader.withSnapshot(async (snapshot) => ({
      principal: await snapshot.openingBalance(ana.principal.id, september.start),
      ahorro: await snapshot.openingBalance(ana.ahorro.id, september.start),
      october: await snapshot.openingBalance(ana.principal.id, period('2026-10').start),
    }));
    expect(opening).toEqual({ principal: 100_000n, ahorro: 0n, october: 85_000n });
  });

  it('HIS-12 con varios asientos en el mismo último instante antes del periodo, el saldo inicial es el del de mayor id', async () => {
    await fund(t, ana.principal.id, '1000.00');
    // Cuatro asientos en el mismo instante (el reloj no se mueve): 1000 -> 999 -> 997 -> 994.
    for (const amount of ['1.00', '2.00', '3.00']) {
      await send(ana, { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id }, amount);
    }
    const reader = new PgStatementReader(harness.app);
    const { rows, opening } = await reader.withSnapshot(async (snapshot) => ({
      rows: (await collect(snapshot.movements(ana.principal.id, EPOCH, FAR_FUTURE))).rows,
      opening: await snapshot.openingBalance(ana.principal.id, period('2026-09').start),
    }));
    expect(new Set(rows.map((row) => row.occurredAt)).size).toBe(1);
    expect(rows.map((row) => row.balanceAfterCents)).toEqual([100_000n, 99_900n, 99_700n, 99_400n]);
    expect(opening).toBe(99_400n);
  });

  it('HIS-12 los movimientos salen en orden ascendente por fecha y, en empate, por id, en tandas por keyset', async () => {
    await fund(t, ana.principal.id, '1000.00');
    // Mismo instante para las cinco: el desempate por id decide el orden y cruza las tandas.
    for (let i = 1; i <= 5; i++) {
      await send(ana, { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id }, `${i}.00`);
    }
    const reader = new PgStatementReader(harness.app, { batchSize: 2 });
    const { sizes, rows } = await reader.withSnapshot((snapshot) =>
      collect(snapshot.movements(ana.principal.id, EPOCH, FAR_FUTURE)),
    );
    expect(sizes).toEqual([2, 2, 2]);
    expect(rows.map((row) => `${row.type} ${row.amountCents}`)).toEqual([
      'DEPOSIT 100000',
      'OWN_TRANSFER_OUT -100',
      'OWN_TRANSFER_OUT -200',
      'OWN_TRANSFER_OUT -300',
      'OWN_TRANSFER_OUT -400',
      'OWN_TRANSFER_OUT -500',
    ]);
    const ids = rows.map((row) => BigInt(row.id));
    expect([...ids].sort((a, b) => (a < b ? -1 : 1))).toEqual(ids);
    expect(rows.at(-1)?.balanceAfterCents).toBe(98_500n);
  });

  it('HIS-12 cada renglón trae la misma proyección que el historial: contraparte, concepto y referencia', async () => {
    await fund(t, ana.principal.id, '1000.00');
    const toLuis = await addBeneficiary(t, ana, {
      name: 'Luis Pérez',
      alias: 'Luis',
      clabe: luis.principal.clabe,
    });
    t.clock.advance(1_000);
    await send(ana, { type: 'BENEFICIARY', beneficiaryId: toLuis }, '150.00');
    const reader = new PgStatementReader(harness.app);
    const { rows } = await reader.withSnapshot((snapshot) =>
      collect(snapshot.movements(ana.principal.id, EPOCH, FAR_FUTURE)),
    );
    expect(rows[1]).toMatchObject({
      type: 'TRANSFER_OUT',
      amountCents: -15_000n,
      balanceAfterCents: 85_000n,
      concept: 'Pago',
      reference: 1,
      counterparty: { name: 'Luis', clabeLast4: luis.principal.clabe.slice(-4) },
    });
  });

  it('HIS-12 un movimiento de las 23:30 del 30 de septiembre en CDMX está en septiembre y no en octubre', async () => {
    t.clock.set('2026-10-01T05:30:00.000Z'); // 23:30 CDMX del 30 de septiembre
    await fund(t, ana.principal.id, '250.00');
    const reader = new PgStatementReader(harness.app);
    const september = period('2026-09');
    const october = period('2026-10');
    const result = await reader.withSnapshot(async (snapshot) => ({
      september: await collect(
        snapshot.movements(ana.principal.id, september.start, september.endExclusive),
      ),
      october: await collect(
        snapshot.movements(ana.principal.id, october.start, october.endExclusive),
      ),
      octoberOpening: await snapshot.openingBalance(ana.principal.id, october.start),
    }));
    expect(result.september.rows.map((row) => row.occurredAt)).toEqual([
      '2026-10-01T05:30:00.000000Z',
    ]);
    expect(result.october.rows).toEqual([]);
    expect(result.octoberOpening).toBe(25_000n);
  });

  it('HIS-12 un mes sin movimientos no produce tandas', async () => {
    const reader = new PgStatementReader(harness.app);
    const { sizes } = await reader.withSnapshot((snapshot) =>
      collect(snapshot.movements(ana.principal.id, EPOCH, FAR_FUTURE)),
    );
    expect(sizes).toEqual([]);
  });

  it('HIS-12 una transferencia confirmada entre el saldo inicial y los movimientos no aparece: misma instantánea', async () => {
    await fund(t, ana.principal.id, '20000.00');
    const toLuis = await addBeneficiary(t, ana, {
      name: 'Luis Pérez',
      alias: 'Luis',
      clabe: luis.principal.clabe,
    });
    // Mayor al umbral: queda PENDING_OTP y se confirma a mitad de la lectura.
    const pending = await send(ana, { type: 'BENEFICIARY', beneficiaryId: toLuis }, '15000.00');
    expect(pending.status).toBe('PENDING_OTP');
    const code = t.mailer.lastCode(ana.person.email);

    const reader = new PgStatementReader(harness.app);
    const inside = await reader.withSnapshot(async (snapshot: StatementSnapshot) => {
      const opening = await snapshot.openingBalance(ana.principal.id, FAR_FUTURE);
      // Otra conexión del pool confirma la transferencia mientras la instantánea sigue abierta.
      t.clock.advance(1_000);
      const confirmed = await confirmTransfer(t, ana, pending.id, { otp: code });
      expect(confirmed.body.status).toBe('COMPLETED');
      const { rows } = await collect(snapshot.movements(ana.principal.id, EPOCH, FAR_FUTURE));
      return { opening, rows };
    });
    expect(inside.opening).toBe(2_000_000n);
    expect(inside.rows.map((row) => row.type)).toEqual(['DEPOSIT']);
    expect(inside.rows.at(-1)?.balanceAfterCents).toBe(inside.opening);

    // Fuera de la instantánea, la transferencia sí está.
    const after = await reader.withSnapshot((snapshot) =>
      collect(snapshot.movements(ana.principal.id, EPOCH, FAR_FUTURE)),
    );
    expect(after.rows.map((row) => row.type)).toEqual(['DEPOSIT', 'TRANSFER_OUT']);
  });

  it('HIS-12 la instantánea se cierra aunque el trabajo falle y la conexión vuelve limpia al pool', async () => {
    // Si la transacción quedara abierta, la conexión volvería al pool dentro de ella: otra lectura
    // vería la instantánea vieja y PostgreSQL la mostraría como "idle in transaction".
    const reader = new PgStatementReader(harness.app);
    await expect(
      reader.withSnapshot(async (snapshot) => {
        await snapshot.openingBalance(ana.principal.id, FAR_FUTURE);
        throw new Error('falla a mitad del documento');
      }),
    ).rejects.toThrow('falla a mitad del documento');
    await fund(t, ana.principal.id, '10.00');
    expect(await reader.withSnapshot((s) => s.openingBalance(ana.principal.id, FAR_FUTURE))).toBe(
      1_000n,
    );
    const [{ open }] = await harness.migrator.query(
      `SELECT count(*)::int AS open FROM pg_stat_activity
        WHERE usename = 'wallet_app' AND state LIKE 'idle in transaction%'`,
    );
    expect(open).toBe(0);
  });
});

describe('HIS-12 caso de uso GenerateStatement con una transferencia concurrente', () => {
  it('HIS-12 una transferencia confirmada después de leer el saldo inicial no aparece en el estado y el resumen cuadra', async () => {
    await fund(t, ana.principal.id, '20000.00'); // 31 de agosto, antes del periodo
    const toLuis = await addBeneficiary(t, ana, {
      name: 'Luis Pérez',
      alias: 'Luis',
      clabe: luis.principal.clabe,
    });
    // Mayor al umbral: queda PENDING_OTP y se confirma a mitad de la generación.
    const pending = await send(ana, { type: 'BENEFICIARY', beneficiaryId: toLuis }, '15000.00');
    expect(pending.status).toBe('PENDING_OTP');
    const code = t.mailer.lastCode(ana.person.email);
    t.clock.advance(3 * 60_000); // 1 de septiembre, 00:01 en CDMX: ya dentro del periodo
    await send(ana, { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id }, '100.00');

    // Lector real; tras leer el saldo inicial, otra conexión confirma la transferencia pendiente.
    const real = new PgStatementReader(harness.app);
    let confirmedDuringRead = false;
    const reader: StatementReader = {
      withSnapshot: (work) =>
        real.withSnapshot((snapshot) =>
          work({
            account: (userId, accountId) => snapshot.account(userId, accountId),
            movements: (accountId, start, end) => snapshot.movements(accountId, start, end),
            openingBalance: async (accountId, start) => {
              const opening = await snapshot.openingBalance(accountId, start);
              if (!confirmedDuringRead) {
                confirmedDuringRead = true;
                t.clock.advance(1_000);
                const confirmed = await confirmTransfer(t, ana, pending.id, { otp: code });
                expect(confirmed.body.status).toBe('COMPLETED');
              }
              return opening;
            },
          }),
        ),
    };
    const rendered: MovementRecord[] = [];
    let summary: ReconciledSummary | undefined;
    const renderer: StatementRenderer = {
      begin: () => ({
        addRows: (rows) => rendered.push(...rows),
        finish: async (reconciled) => {
          summary = reconciled;
          return new TextEncoder().encode('%PDF-falso');
        },
      }),
    };
    const audit = {
      recordStandalone: async () => undefined,
    } as unknown as AuditWriter;
    const useCase = new GenerateStatement({
      reader,
      renderer,
      audit,
      // Septiembre ya terminó para el reloj del caso de uso; el de la app sigue dentro del mes.
      clock: new FakeClock('2026-10-14T18:00:00.000Z'),
      logger: captureLogger().logger,
    });

    await useCase.execute(ana.userId, ana.principal.id, '2026-09');

    expect(confirmedDuringRead).toBe(true);
    // La transferencia sí quedó confirmada en la base...
    const [{ n }] = await harness.migrator.query(
      `SELECT count(*)::int AS n FROM app.ledger_entries
        WHERE account_id = $1 AND type = 'TRANSFER_OUT'`,
      [ana.principal.id],
    );
    expect(n).toBe(1);
    // ...pero la instantánea no la vio: solo el traspaso de 100.00 y un resumen que cuadra.
    expect(rendered.map((row) => `${row.type} ${row.amountCents}`)).toEqual([
      'OWN_TRANSFER_OUT -10000',
    ]);
    expect(summary).toEqual({
      openingCents: 2_000_000n,
      creditsCents: 0n,
      debitsCents: 10_000n,
      closingCents: 1_990_000n,
      count: 1,
    });
    const figures = summary as ReconciledSummary;
    expect(figures.openingCents + figures.creditsCents - figures.debitsCents).toBe(
      figures.closingCents,
    );
  });
});
