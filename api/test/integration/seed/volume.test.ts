import { describe, expect, it } from 'vitest';
import { seedDemoData, type DemoData } from '../../../src/seed/demo-data.js';
import { seedVolume } from '../../../src/seed/volume.js';
import { seedWindow } from '../../../src/seed/window.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { reconcile } from '../../helpers/reconciliation.js';

const harness = useIntegrationHarness();
// "Hoy" del seed: 2026-10-13 a las 12:00 de CDMX. La ventana termina el 12 a las 23:59.
const window = seedWindow(new Date('2026-10-13T18:00:00.000Z'));

async function demo(): Promise<DemoData> {
  return seedDemoData(harness.migrator, {
    clabe: { bankCode: '999', plazaCode: '180' },
    generatedUsers: 3,
    fundedAt: window.fundedAt,
  });
}

const volume = { transfers: 230, batchSize: 70, monthlyDeposits: 12 };

describe('HIS-10 generación de volumen', () => {
  it('HIS-10 la ventana son 12 meses que terminan ayer a las 23:59 de CDMX', () => {
    expect(window.end.toISOString()).toBe('2026-10-13T05:59:00.000Z');
    expect(window.start.toISOString()).toBe('2025-10-13T05:59:00.000Z');
    expect(window.fundedAt.getTime()).toBeLessThan(window.start.getTime());
  });

  it('HIS-10 genera las transferencias completadas con sus asientos, casi todas en "Principal" de Ana', async () => {
    const data = await demo();
    const result = await seedVolume(harness.migrator, data, { ...volume, window });
    expect(result).toEqual({ transfers: 230, deposits: 12, skipped: false });
    const [counts] = await harness.migrator.query(
      `SELECT (SELECT count(*) FROM app.transfers WHERE status = 'COMPLETED')::int AS transfers,
              (SELECT count(*) FROM app.transfers WHERE status <> 'COMPLETED')::int AS others,
              (SELECT count(*) FROM app.ledger_entries)::int AS entries,
              (SELECT count(*) FROM app.ledger_entries WHERE account_id = $1)::int AS ana`,
      [data.ana.principal.id],
    );
    // 5 fondeos iniciales + 12 depósitos mensuales + 230 transferencias, todas con un lado en
    // "Principal" de Ana.
    expect(counts).toEqual({ transfers: 247, others: 0, entries: 494, ana: 1 + 12 + 230 });
    const types = await harness.migrator.query(
      `SELECT type, count(*)::int AS n FROM app.ledger_entries WHERE account_id = $1
        GROUP BY type ORDER BY type`,
      [data.ana.principal.id],
    );
    expect(types).toEqual([
      { type: 'DEPOSIT', n: 13 },
      { type: 'OWN_TRANSFER_IN', n: 23 },
      { type: 'OWN_TRANSFER_OUT', n: 23 },
      { type: 'TRANSFER_IN', n: 92 },
      { type: 'TRANSFER_OUT', n: 92 },
    ]);
  });

  it('HIS-10 todo cae dentro de la ventana: nada del día actual de CDMX', async () => {
    const data = await demo();
    await seedVolume(harness.migrator, data, { ...volume, window });
    const [range] = await harness.migrator.query(
      `SELECT min(created_at) AS first, max(created_at) AS last FROM app.ledger_entries
        WHERE created_at > $1`,
      [window.fundedAt],
    );
    expect(range.first.getTime()).toBeGreaterThanOrEqual(window.start.getTime());
    expect(range.last.getTime()).toBeLessThanOrEqual(window.end.getTime());
  });

  it('HIS-10 balance_after es el acumulado de cada cuenta, nunca negativo en cuentas USER, y todo suma cero', async () => {
    const data = await demo();
    await seedVolume(harness.migrator, data, { ...volume, window });
    const result = await reconcile(harness.migrator);
    expect(result.brokenChain).toEqual([]);
    expect(result.globalSum).toBe('0');
    const [{ n }] = await harness.migrator.query(
      `SELECT count(*)::int AS n FROM app.ledger_entries e JOIN app.accounts a ON a.id = e.account_id
        WHERE a.type = 'USER' AND e.balance_after_cents < 0`,
    );
    expect(n).toBe(0);
  });

  it('HIS-10 las transferencias a terceros usan beneficiarios del remitente, como las de la API', async () => {
    const data = await demo();
    await seedVolume(harness.migrator, data, { ...volume, window });
    const [{ n }] = await harness.migrator.query(
      `SELECT count(*)::int AS n FROM app.transfers t
         JOIN app.beneficiaries b ON b.id = t.beneficiary_id
        WHERE t.kind = 'THIRD_PARTY' AND (b.user_id <> t.user_id OR b.account_id <> t.to_account_id)`,
    );
    expect(n).toBe(0);
  });

  it('HIS-10 sin depósitos de por medio, los ciclos por sí solos nunca dejan saldos USER negativos', async () => {
    // Con depósitos de 25,000.00 cualquier plan pasaría en pequeño: aquí solo cuenta el diseño de
    // los ciclos, que es lo que sostiene las 60,000 transferencias del seed completo.
    const data = await demo();
    await seedVolume(harness.migrator, data, {
      transfers: 1000,
      batchSize: 400,
      monthlyDeposits: 0,
      window,
    });
    const [lowest] = await harness.migrator.query(
      `SELECT min(e.balance_after_cents)::text AS min FROM app.ledger_entries e
         JOIN app.accounts a ON a.id = e.account_id WHERE a.type = 'USER'`,
    );
    expect(BigInt(lowest.min)).toBeGreaterThanOrEqual(0n);
    expect((await reconcile(harness.migrator)).brokenChain).toEqual([]);
  });

  it('HIS-10 es idempotente: una segunda corrida no agrega movimientos', async () => {
    const data = await demo();
    await seedVolume(harness.migrator, data, { ...volume, window });
    const again = await seedVolume(harness.migrator, data, { ...volume, window });
    expect(again).toEqual({ transfers: 0, deposits: 0, skipped: true });
    const [{ n }] = await harness.migrator.query(
      'SELECT count(*)::int AS n FROM app.ledger_entries',
    );
    expect(n).toBe(494);
  });
});
