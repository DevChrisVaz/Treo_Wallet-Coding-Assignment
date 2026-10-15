import { describe, expect, it } from 'vitest';
import type { AuditWriter } from '../../../src/modules/audit/application/audit-writer.js';
import type { AuditEvent } from '../../../src/modules/audit/domain/audit-event.js';
import type { MovementRecord } from '../../../src/modules/movements/application/ports.js';
import { GenerateStatement } from '../../../src/modules/statements/application/generate-statement.js';
import type {
  StatementAccount,
  StatementHeader,
  StatementReader,
  StatementRenderer,
  StatementSnapshot,
} from '../../../src/modules/statements/application/ports.js';
import type { ReconciledSummary } from '../../../src/modules/statements/domain/statement-summary.js';
import { DomainError } from '../../../src/shared/errors.js';
import { FakeClock } from '../../helpers/fake-clock.js';
import { captureLogger } from '../../helpers/logs.js';

const ANA = '6f1c1d4e-0d55-4a7a-9f4b-2b8c9d1e2f3a';
const ACCOUNT: StatementAccount = {
  id: '7b1f0a52-3c1e-4d8e-9a55-2f7d1c3b9e10',
  name: 'Principal',
  clabe: '999180000000000015',
  holderName: 'Ana Gómez Cruz',
  // Septiembre de 2026 en CDMX (el 1 de septiembre a las 00:30 locales).
  createdAt: new Date('2026-09-01T06:30:00.000Z'),
};

function entry(amountCents: bigint, balanceAfterCents: bigint): MovementRecord {
  return {
    id: '1',
    type: amountCents > 0n ? 'TRANSFER_IN' : 'TRANSFER_OUT',
    amountCents,
    balanceAfterCents,
    occurredAt: '2026-09-10T18:00:00.000000Z',
    transferId: 't',
    concept: 'Pago',
    reference: 1,
    counterparty: null,
  };
}

function setup(options: { rows?: MovementRecord[]; opening?: bigint } = {}) {
  const calls = { snapshots: 0, audited: [] as AuditEvent[], rendered: [] as MovementRecord[] };
  let summary: ReconciledSummary | undefined;
  let header: StatementHeader | undefined;
  const snapshot: StatementSnapshot = {
    account: async (userId, accountId) =>
      userId === ANA && accountId === ACCOUNT.id ? ACCOUNT : null,
    openingBalance: async () => options.opening ?? 100_000n,
    movements: async function* () {
      if (options.rows && options.rows.length > 0) yield options.rows;
    },
  };
  const reader: StatementReader = {
    withSnapshot: async (work) => {
      calls.snapshots += 1;
      return work(snapshot);
    },
  };
  const renderer: StatementRenderer = {
    begin: (h) => {
      header = h;
      return {
        addRows: (rows) => calls.rendered.push(...rows),
        finish: async (s) => {
          summary = s;
          return new TextEncoder().encode('%PDF-falso');
        },
      };
    },
  };
  const audit: AuditWriter = {
    record: async () => {
      throw new Error('no se usa');
    },
    recordStandalone: async (event) => {
      calls.audited.push(event);
    },
  };
  const logs = captureLogger();
  const useCase = new GenerateStatement({
    reader,
    renderer,
    audit,
    clock: new FakeClock('2026-10-14T18:00:00.000Z'),
    logger: logs.logger,
  });
  return { useCase, calls, logs, summary: () => summary, header: () => header };
}

async function failure(promise: Promise<unknown>): Promise<DomainError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof DomainError) return error;
    throw error;
  }
  throw new Error('No falló');
}

describe('HIS-11 caso de uso GenerateStatement', () => {
  it('HIS-11 entrega los bytes y el nombre estado-de-cuenta-<periodo>-<últimos 4 de la CLABE>.pdf', async () => {
    const { useCase, calls, summary, header } = setup({
      rows: [entry(50_000n, 150_000n), entry(-15_000n, 135_000n)],
    });
    const statement = await useCase.execute(ANA, ACCOUNT.id, '2026-09');
    expect(statement.filename).toBe('estado-de-cuenta-2026-09-0015.pdf');
    expect(new TextDecoder().decode(statement.bytes)).toBe('%PDF-falso');
    expect(calls.rendered).toHaveLength(2);
    expect(summary()).toMatchObject({ creditsCents: 50_000n, debitsCents: 15_000n, count: 2 });
    expect(header()?.period.value).toBe('2026-09');
  });

  it('HIS-11 un periodo con formato inválido es 422 VALIDATION_FAILED en /period sin abrir la instantánea', async () => {
    const { useCase, calls } = setup();
    const error = await failure(useCase.execute(ANA, ACCOUNT.id, '2026-13'));
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.extensions.errors).toEqual([
      expect.objectContaining({ pointer: '/period', code: 'INVALID_FORMAT' }),
    ]);
    expect(calls.snapshots).toBe(0);
  });

  it('HIS-11 un mes futuro es 422 VALIDATION_FAILED con DATE_OUT_OF_RANGE en /period', async () => {
    const { useCase, calls } = setup();
    const error = await failure(useCase.execute(ANA, ACCOUNT.id, '2026-11'));
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.extensions.errors).toEqual([
      expect.objectContaining({ pointer: '/period', code: 'DATE_OUT_OF_RANGE' }),
    ]);
    expect(calls.snapshots).toBe(0);
  });

  it('HIS-11 un periodo anterior al mes de apertura de la cuenta (CDMX) es 422 DATE_OUT_OF_RANGE en /period, sin auditar', async () => {
    const { useCase, calls } = setup();
    const error = await failure(useCase.execute(ANA, ACCOUNT.id, '2026-08'));
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.extensions.errors).toEqual([
      expect.objectContaining({ pointer: '/period', code: 'DATE_OUT_OF_RANGE' }),
    ]);
    expect(calls.audited).toEqual([]);
    expect(calls.rendered).toEqual([]);
  });

  it('HIS-11 el mes de apertura y el mes en curso se entregan (la apertura se mide en CDMX, no en UTC)', async () => {
    const { useCase } = setup();
    // 2026-09-01T06:30Z es septiembre en CDMX; el 31-ago a las 23:00 locales (05:00Z del 1) sería agosto.
    expect((await useCase.execute(ANA, ACCOUNT.id, '2026-09')).filename).toContain('2026-09');
    expect((await useCase.execute(ANA, ACCOUNT.id, '2026-10')).filename).toContain('2026-10');
  });

  it('HIS-11 una cuenta ajena sigue siendo 404 aunque el periodo sea anterior a su apertura', async () => {
    const { useCase } = setup();
    const error = await failure(
      useCase.execute(ANA, '00000000-0000-4000-8000-000000000000', '2026-01'),
    );
    expect(error.code).toBe('NOT_FOUND');
  });

  it('HIS-11 un id que no es UUID es 404 sin abrir la instantánea, igual que una cuenta ajena', async () => {
    const { useCase, calls } = setup();
    expect((await failure(useCase.execute(ANA, 'no-es-uuid', '2026-09'))).code).toBe('NOT_FOUND');
    expect(calls.snapshots).toBe(0);
    const foreign = await failure(
      useCase.execute(ANA, '00000000-0000-4000-8000-000000000000', '2026-09'),
    );
    expect(foreign.code).toBe('NOT_FOUND');
    expect(calls.audited).toEqual([]);
  });

  it('AUD-07 audita STATEMENT_EXPORTED con el usuario, la cuenta y el periodo, sin CLABE, nombre ni montos', async () => {
    const { useCase, calls } = setup({ rows: [entry(50_000n, 150_000n)] });
    await useCase.execute(ANA, ACCOUNT.id, '2026-09');
    expect(calls.audited).toEqual([
      {
        action: 'STATEMENT_EXPORTED',
        actor: { type: 'USER', userId: ANA },
        entity: { type: 'ACCOUNT', id: ACCOUNT.id },
        metadata: { period: '2026-09' },
      },
    ]);
  });

  it('HIS-12 si el resumen no cuadra responde INTERNAL_ERROR, deja un log ERROR y no audita', async () => {
    const { useCase, calls, logs } = setup({ rows: [entry(50_000n, 140_000n)] });
    const error = await failure(useCase.execute(ANA, ACCOUNT.id, '2026-09'));
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(calls.audited).toEqual([]);
    const alert = logs.entries().find((line) => line.msg === 'statement does not reconcile');
    expect(alert).toMatchObject({
      level: 'error',
      alert: true,
      accountId: ACCOUNT.id,
      period: '2026-09',
      openingCents: '100000',
      creditsCents: '50000',
      debitsCents: '0',
      closingCents: '140000',
    });
  });
});
