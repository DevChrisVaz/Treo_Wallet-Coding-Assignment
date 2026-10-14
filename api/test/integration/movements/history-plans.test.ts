import { describe, expect, it } from 'vitest';
import type { MovementPageQuery } from '../../../src/modules/movements/application/ports.js';
import { buildMovementQuery } from '../../../src/modules/movements/infrastructure/pg-movement-reader.js';
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
  it('HIS-09 sin filtros usa ix_ledger_entries_account_created y con DEPOSIT ix_ledger_entries_account_type_created, ambas sin nodo Sort', async () => {
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
