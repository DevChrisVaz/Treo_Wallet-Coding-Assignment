import { describe, expect, it } from 'vitest';
import type { MovementPageQuery } from '../../../src/modules/movements/application/ports.js';
import { MovementCursor } from '../../../src/modules/movements/application/cursor.js';
import { ListMovements } from '../../../src/modules/movements/application/list-movements.js';
import {
  buildMovementQuery,
  PgMovementReader,
} from '../../../src/modules/movements/infrastructure/pg-movement-reader.js';
import { runSeed } from '../../../src/seed/run-seed.js';
import { useIntegrationHarness } from '../../helpers/harness.js';

const harness = useIntegrationHarness();

interface PlanNode {
  'Node Type': string;
  'Index Name'?: string;
  Plans?: PlanNode[];
}

function nodes(plan: PlanNode): PlanNode[] {
  return [plan, ...(plan.Plans ?? []).flatMap(nodes)];
}

async function explain(query: MovementPageQuery): Promise<PlanNode[]> {
  const { sql, params } = buildMovementQuery(query);
  const [row] = await harness.app.query(`EXPLAIN (FORMAT JSON) ${sql}`, params);
  const plan = (row['QUERY PLAN'] as { Plan: PlanNode }[])[0]?.Plan;
  if (!plan) throw new Error('EXPLAIN no devolvió un plan');
  return nodes(plan);
}

describe('HIS-09 planes del historial con volumen', () => {
  // Con poco volumen el planificador prefiere, para un tipo poco frecuente, un Bitmap Heap Scan
  // seguido de Sort (barato con 13 filas). HIS-09 trata del volumen real, así que esta prueba
  // siembra lo mismo que `db:seed` (≈120k asientos) una sola vez y revisa las dos consultas.
  it('HIS-08 y HIS-09 con 60000 movimientos, la primera página trae los 20 más recientes; sin filtros usa ix_ledger_entries_account_created y con DEPOSIT ix_ledger_entries_account_type_created, ambas sin nodo Sort', async () => {
    const summary = await runSeed(harness.migrator, {
      clabe: { bankCode: '999', plazaCode: '180' },
      now: new Date('2026-10-13T18:00:00.000Z'),
      generatedUsers: 50,
      transfers: 60_000,
      batchSize: 10_000,
      monthlyDeposits: 12,
      minEntries: 100_000,
    });
    expect(summary.entries).toBeGreaterThanOrEqual(100_000);
    const accountId = summary.anaPrincipalId;
    // Sin estadísticas frescas el planificador a veces cambia de plan entre corridas; el
    // ANALYZE hace determinista lo que se mide (en producción lo hace el autovacuum).
    await harness.migrator.query('ANALYZE app.ledger_entries');

    // HIS-08: la cuenta sembrada más grande (la principal de Ana) rebasa los 60,000 asientos.
    expect(summary.anaPrincipalEntries).toBeGreaterThanOrEqual(60_000);
    const expectedIds: { id: string }[] = await harness.migrator.query(
      `SELECT id::text AS id FROM app.ledger_entries WHERE account_id = $1
        ORDER BY created_at DESC, id DESC LIMIT 20`,
      [accountId],
    );
    expect(expectedIds).toHaveLength(20);
    const reader = new PgMovementReader(harness.app);
    const list = new ListMovements({
      accounts: { findOwnedBy: async () => ({ id: accountId }) } as never,
      reader,
      cursors: new MovementCursor(Buffer.alloc(32, 7)),
    });
    const firstPage = await list.execute('ana', accountId, { types: [], limit: 20 });
    expect(firstPage.items.map((item) => item.id)).toEqual(expectedIds.map((row) => row.id));
    expect(firstPage.nextCursor).toEqual(expect.any(String));
    const occurred = firstPage.items.map((item) => Date.parse(item.occurredAt));
    expect(occurred).toEqual([...occurred].sort((a, b) => b - a));

    const latest = await explain({ accountId, types: [], limit: 21 });
    expect(latest.map((node) => node['Index Name'])).toContain('ix_ledger_entries_account_created');
    expect(latest.map((node) => node['Node Type'])).not.toContain('Sort');
    expect(latest.map((node) => node['Node Type'])).not.toContain('Incremental Sort');

    const deposits = await explain({ accountId, types: ['DEPOSIT'], limit: 21 });
    expect(deposits.map((node) => node['Index Name'])).toContain(
      'ix_ledger_entries_account_type_created',
    );
    expect(deposits.map((node) => node['Node Type'])).not.toContain('Sort');
    expect(deposits.map((node) => node['Node Type'])).not.toContain('Incremental Sort');
  }, 180_000);
});
