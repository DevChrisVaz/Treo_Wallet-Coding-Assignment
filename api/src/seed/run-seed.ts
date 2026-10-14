import type { DataSource } from 'typeorm';
import { businessDayOf, startOfBusinessDay } from '../shared/business-day.js';
import { seedDemoData } from './demo-data.js';
import { seedVolume, type VolumeResult } from './volume.js';
import { seedWindow } from './window.js';

export interface SeedOptions {
  readonly clabe: { readonly bankCode: string; readonly plazaCode: string };
  /** "Ahora" del seed: la ventana termina ayer a las 23:59 de CDMX respecto a este instante. */
  readonly now: Date;
  readonly generatedUsers: number;
  readonly transfers: number;
  readonly batchSize: number;
  readonly monthlyDeposits: number;
  /** Mínimo de asientos que la verificación final exige (100,000 en el seed completo). */
  readonly minEntries: number;
}

export interface SeedSummary {
  readonly volume: VolumeResult;
  readonly entries: number;
  readonly anaPrincipalId: string;
  readonly anaPrincipalEntries: number;
}

/** Alguna invariante del ledger no se cumple al terminar el seed: el comando debe fallar. */
export class SeedInvariantError extends Error {
  constructor(readonly failures: readonly string[]) {
    super(`El seed no cumple sus invariantes:\n- ${failures.join('\n- ')}`);
    this.name = 'SeedInvariantError';
  }
}

/** Deja el saldo de cada cuenta en el `balance_after` de su último asiento (HIS-10). */
async function adjustBalances(migrator: DataSource): Promise<void> {
  await migrator.query(
    `UPDATE app.accounts a SET balance_cents = last.balance_after_cents
       FROM (SELECT DISTINCT ON (account_id) account_id, balance_after_cents
               FROM app.ledger_entries ORDER BY account_id, created_at DESC, id DESC) last
      WHERE a.id = last.account_id AND a.balance_cents <> last.balance_after_cents`,
  );
}

/**
 * Invariantes del seed (HIS-10, ACC-14): suficientes asientos, suma global cero, ningún
 * `balance_after` negativo en cuentas USER, cadena de `balance_after` igual al acumulado de cada
 * cuenta, saldo igual al último `balance_after`, Tesorería igual al negativo de las cuentas USER y
 * nada en el día actual de CDMX. Lanza `SeedInvariantError` con todas las que fallan.
 */
export async function verifySeed(
  migrator: DataSource,
  options: { readonly now: Date; readonly minEntries: number },
): Promise<number> {
  const today = startOfBusinessDay(businessDayOf(options.now));
  const [row] = await migrator.query(
    `SELECT (SELECT count(*) FROM app.ledger_entries)::int AS entries,
            (SELECT COALESCE(sum(amount_cents), 0) FROM app.ledger_entries)::text AS total,
            (SELECT count(*) FROM app.ledger_entries e JOIN app.accounts a ON a.id = e.account_id
              WHERE a.type = 'USER' AND e.balance_after_cents < 0)::int AS negative,
            (SELECT count(*) FROM (
               SELECT balance_after_cents,
                      sum(amount_cents) OVER (PARTITION BY account_id ORDER BY created_at, id) AS running
                 FROM app.ledger_entries) chain
              WHERE balance_after_cents <> running)::int AS broken,
            (SELECT count(*) FROM app.accounts a
               LEFT JOIN LATERAL (SELECT balance_after_cents FROM app.ledger_entries e
                                   WHERE e.account_id = a.id
                                   ORDER BY created_at DESC, id DESC LIMIT 1) last ON true
              WHERE a.balance_cents <> COALESCE(last.balance_after_cents, 0))::int AS stale,
            ((SELECT balance_cents FROM app.accounts WHERE type = 'SYSTEM')
              + (SELECT COALESCE(sum(balance_cents), 0) FROM app.accounts WHERE type = 'USER'))::text AS gap,
            (SELECT count(*) FROM app.ledger_entries WHERE created_at >= $1)::int AS today`,
    [today],
  );
  const failures: string[] = [];
  if (row.entries < options.minEntries) {
    failures.push(`se esperaban al menos ${options.minEntries} asientos y hay ${row.entries}`);
  }
  if (row.total !== '0') failures.push(`la suma global de asientos es ${row.total}, no 0`);
  if (row.negative > 0)
    failures.push(`hay ${row.negative} balance_after negativos en cuentas USER`);
  if (row.broken > 0) failures.push(`hay ${row.broken} balance_after que no son el acumulado`);
  if (row.stale > 0)
    failures.push(`hay ${row.stale} cuentas con saldo distinto a su último asiento`);
  if (row.gap !== '0')
    failures.push(`la Tesorería no es el negativo de las cuentas USER (${row.gap})`);
  if (row.today > 0) {
    failures.push(`hay ${row.today} asientos del día actual de America/Mexico_City`);
  }
  if (failures.length > 0) throw new SeedInvariantError(failures);
  return row.entries;
}

/**
 * `db:seed` completo (HIS-10): datos demo, volumen por tandas, ajuste de saldos al último
 * `balance_after`, `ANALYZE` para que el planificador conozca el volumen y verificación de
 * invariantes, que hace fallar el comando si alguna no se cumple. Idempotente.
 */
export async function runSeed(migrator: DataSource, options: SeedOptions): Promise<SeedSummary> {
  const window = seedWindow(options.now);
  const data = await seedDemoData(migrator, {
    clabe: options.clabe,
    generatedUsers: options.generatedUsers,
    fundedAt: window.fundedAt,
  });
  const volume = await seedVolume(migrator, data, {
    transfers: options.transfers,
    batchSize: options.batchSize,
    monthlyDeposits: options.monthlyDeposits,
    window,
  });
  await adjustBalances(migrator);
  await migrator.query('ANALYZE app.accounts, app.transfers, app.ledger_entries');
  const entries = await verifySeed(migrator, options);
  const [{ n }] = await migrator.query(
    'SELECT count(*)::int AS n FROM app.ledger_entries WHERE account_id = $1',
    [data.ana.principal.id],
  );
  return { volume, entries, anaPrincipalId: data.ana.principal.id, anaPrincipalEntries: n };
}
