import type { DataSource } from 'typeorm';
import type { DemoData } from './demo-data.js';

export interface VolumeOptions {
  /** Transferencias de usuario a generar (60,000 en el seed completo). */
  readonly transfers: number;
  /** Transferencias por transacción. */
  readonly batchSize: number;
  /** Depósitos de la Tesorería a "Principal" de Ana a lo largo de la ventana (tipo poco frecuente). */
  readonly monthlyDeposits: number;
  readonly window: { readonly start: Date; readonly end: Date };
}

export interface VolumeResult {
  readonly transfers: number;
  readonly deposits: number;
  readonly skipped: boolean;
}

const CONCEPTS = [
  'Renta',
  'Súper',
  'Comida',
  'Servicios',
  'Gasolina',
  'Colegiatura',
  'Préstamo',
  'Regalo',
  'Cena',
  'Viaje',
  'Cuota',
  'Pago',
];
const DEPOSIT_CENTS = '2500000';

/**
 * Plan de una tanda, calculado en SQL con `generate_series` sobre el índice `i` de la
 * transferencia. Cada ciclo de 10 transferencias de "Principal" de Ana es: 4 entradas de terceros
 * (500.00 a 999.99), 3 salidas a sus beneficiarios (100.00 a 399.99), un traspaso a "Ahorro"
 * (200.00 a 299.99), uno de regreso (100.00 a 149.99) y otra salida. Con ese orden ningún saldo
 * USER baja de cero: cada ciclo deja al menos +200.00 en "Principal", "Ahorro" recibe antes de
 * enviar y los demás usuarios fueron fondeados con más de lo que envían en total.
 */
const PLAN_SQL = `
CREATE TEMP TABLE seed_plan ON COMMIT DROP AS
WITH idx AS (
  SELECT i, i % 10 AS c, i / 10 AS cycle FROM generate_series($1::bigint, $2::bigint) AS i
)
SELECT i,
       gen_random_uuid() AS transfer_id,
       CASE WHEN c IN (7, 8) THEN 'OWN' ELSE 'THIRD_PARTY' END AS kind,
       CASE WHEN c < 4 THEN ($3::uuid[])[1 + ((cycle * 4 + c) % $4)::int] ELSE $5::uuid END AS user_id,
       CASE WHEN c < 4 THEN ($6::uuid[])[1 + ((cycle * 4 + c) % $4)::int]
            WHEN c = 8 THEN $8::uuid
            ELSE $7::uuid END AS from_account,
       CASE WHEN c < 4 THEN $7::uuid
            WHEN c = 7 THEN $8::uuid
            WHEN c = 8 THEN $7::uuid
            ELSE ($9::uuid[])[1 + ((cycle + c) % $11)::int] END AS to_account,
       CASE WHEN c < 4 THEN ($12::uuid[])[1 + ((cycle * 4 + c) % $4)::int]
            WHEN c IN (7, 8) THEN NULL
            ELSE ($10::uuid[])[1 + ((cycle + c) % $11)::int] END AS beneficiary_id,
       (CASE WHEN c < 4 THEN 50000 + (i * 7919) % 50000
             WHEN c = 7 THEN 20000 + (i * 31) % 10000
             WHEN c = 8 THEN 10000 + (i * 17) % 5000
             ELSE 10000 + (i * 104729) % 30000 END)::bigint AS amount_cents,
       ($13::text[])[1 + (i % cardinality($13::text[]))::int] AS concept,
       (i % 10000000)::int AS reference,
       $14::timestamptz + floor((i + 0.5) * $15::float8) * interval '1 millisecond' AS created_at
  FROM idx
UNION ALL
SELECT $16::bigint + d.m AS i,
       gen_random_uuid(),
       'FUNDING',
       NULL::uuid,
       $17::uuid,
       $7::uuid,
       NULL::uuid,
       $18::bigint,
       'Depósito de nómina',
       0,
       d.at
  FROM unnest($19::timestamptz[]) WITH ORDINALITY AS d(at, m)`;

const TRANSFERS_SQL = `
INSERT INTO app.transfers (id, user_id, idempotency_key, request_fingerprint, kind, status,
                           from_account_id, to_account_id, beneficiary_id, amount_cents, concept,
                           reference, requires_otp, created_at, completed_at)
SELECT transfer_id, user_id,
       CASE WHEN kind = 'FUNDING' THEN NULL ELSE transfer_id END,
       CASE WHEN kind = 'FUNDING' THEN NULL
            ELSE encode(sha256(convert_to(transfer_id::text, 'UTF8')), 'hex') END,
       kind, 'COMPLETED', from_account, to_account, beneficiary_id, amount_cents, concept,
       reference, false, created_at, created_at
  FROM seed_plan`;

/**
 * Asientos de la tanda: dos por transferencia, con \`balance_after\` calculado en staging con una
 * suma acumulada por cuenta (función de ventana) a partir del último \`balance_after\` ya guardado.
 * Se insertan en orden cronológico, así el id también crece con el tiempo.
 */
const ENTRIES_SQL = `
WITH sides AS (
  SELECT p.transfer_id, p.i, p.created_at, s.ord, s.account_id, s.type, s.amount_cents
    FROM seed_plan p
   CROSS JOIN LATERAL (VALUES
     (0, p.from_account,
      CASE p.kind WHEN 'OWN' THEN 'OWN_TRANSFER_OUT' ELSE 'TRANSFER_OUT' END,
      -p.amount_cents),
     (1, p.to_account,
      CASE p.kind WHEN 'OWN' THEN 'OWN_TRANSFER_IN' WHEN 'FUNDING' THEN 'DEPOSIT' ELSE 'TRANSFER_IN' END,
      p.amount_cents)
   ) AS s(ord, account_id, type, amount_cents)
), opening AS (
  SELECT a.account_id,
         COALESCE((SELECT e.balance_after_cents FROM app.ledger_entries e
                    WHERE e.account_id = a.account_id
                    ORDER BY e.created_at DESC, e.id DESC LIMIT 1), 0) AS balance
    FROM (SELECT DISTINCT account_id FROM sides) a
)
INSERT INTO app.ledger_entries (transfer_id, account_id, type, amount_cents, balance_after_cents,
                                created_at)
SELECT s.transfer_id, s.account_id, s.type, s.amount_cents,
       o.balance + SUM(s.amount_cents) OVER (PARTITION BY s.account_id
                                             ORDER BY s.created_at, s.i, s.ord
                                             ROWS UNBOUNDED PRECEDING),
       s.created_at
  FROM sides s JOIN opening o ON o.account_id = s.account_id
 ORDER BY s.created_at, s.i, s.ord`;

/** Los depósitos se auditan como cualquier fondeo (FUNDING_POSTED, actor SYSTEM). */
const AUDIT_SQL = `
INSERT INTO app.audit_log (occurred_at, actor_type, action, entity_type, entity_id, metadata)
SELECT created_at, 'SYSTEM', 'FUNDING_POSTED', 'transfer', transfer_id::text,
       jsonb_build_object('accountId', to_account,
                          'amount', (amount_cents / 100)::text || '.' || lpad((amount_cents % 100)::text, 2, '0'))
  FROM seed_plan WHERE kind = 'FUNDING'`;

/** Instante con microsegundos `.mmm250`: nunca coincide con una transferencia (milisegundos). */
function depositInstant(ms: number): string {
  return new Date(ms).toISOString().replace(/Z$/, '250Z');
}

/**
 * Movimientos de volumen (HIS-10): `transfers` transferencias completadas por tandas (cada una en
 * su transacción, con los triggers de partida doble activos) repartidas uniformemente en la
 * ventana, todas con un lado en "Principal" de Ana, más depósitos periódicos de la Tesorería.
 * Idempotente: si "Principal" de Ana ya tiene más que su fondeo inicial, no hace nada. Los saldos
 * de las cuentas se ajustan al final del seed.
 */
export async function seedVolume(
  migrator: DataSource,
  data: DemoData,
  options: VolumeOptions,
): Promise<VolumeResult> {
  const [{ n }] = await migrator.query(
    `SELECT count(*)::int AS n FROM app.ledger_entries WHERE account_id = $1`,
    [data.ana.principal.id],
  );
  if (n > 1) return { transfers: 0, deposits: 0, skipped: true };

  const [{ id: treasuryId }] = await migrator.query(
    `SELECT id FROM app.accounts WHERE type = 'SYSTEM'`,
  );
  const start = options.window.start.getTime();
  const span = options.window.end.getTime() - start;
  const step = span / options.transfers;
  const others = data.others;
  const batches = Math.ceil(options.transfers / options.batchSize);
  const depositsByBatch = Array.from({ length: batches }, () => [] as string[]);
  for (let m = 0; m < options.monthlyDeposits; m++) {
    const at = start + Math.floor(((m + 0.5) * span) / options.monthlyDeposits);
    const index = Math.max(0, Math.ceil((at - start) / step - 0.5));
    const batch = Math.min(batches - 1, Math.floor(index / options.batchSize));
    depositsByBatch[batch]?.push(depositInstant(at));
  }

  for (let batch = 0; batch < batches; batch++) {
    const lo = batch * options.batchSize;
    const hi = Math.min(options.transfers, lo + options.batchSize) - 1;
    const runner = migrator.createQueryRunner();
    await runner.connect();
    try {
      await runner.startTransaction();
      await runner.query(PLAN_SQL, [
        lo,
        hi,
        others.map((user) => user.userId),
        others.length,
        data.ana.userId,
        others.map((user) => user.principal.id),
        data.ana.principal.id,
        data.ana.ahorro.id,
        data.anaBeneficiaries.map((beneficiary) => beneficiary.accountId),
        data.anaBeneficiaries.map((beneficiary) => beneficiary.id),
        data.anaBeneficiaries.length,
        others.map((user) => data.beneficiaryToAna.get(user.userId)),
        CONCEPTS,
        options.window.start,
        step,
        options.transfers,
        treasuryId,
        DEPOSIT_CENTS,
        depositsByBatch[batch] ?? [],
      ]);
      await runner.query(TRANSFERS_SQL);
      await runner.query(ENTRIES_SQL);
      await runner.query(AUDIT_SQL);
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction();
      throw error;
    } finally {
      await runner.release();
    }
  }
  return { transfers: options.transfers, deposits: options.monthlyDeposits, skipped: false };
}
