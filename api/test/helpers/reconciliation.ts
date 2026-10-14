import type { DataSource } from 'typeorm';

export interface Reconciliation {
  /** Cuentas cuyo saldo no es la suma de sus asientos. */
  readonly mismatchedBalances: string[];
  /** Suma de todos los asientos del sistema: debe ser 0. */
  readonly globalSum: string;
  /** Asientos cuyo balance_after no es el acumulado de su cuenta. */
  readonly brokenChain: string[];
  /** Saldo de la Tesorería + suma de saldos USER: debe ser 0. */
  readonly treasuryGap: string;
}

/**
 * Consultas de conciliación del diseño (ACC-14, TRF-22), con el rol dueño. Son las mismas que se
 * documentan en el README para revisar la base a mano.
 */
export async function reconcile(db: DataSource): Promise<Reconciliation> {
  const mismatched: { id: string }[] = await db.query(
    `SELECT a.id FROM app.accounts a
       LEFT JOIN app.ledger_entries e ON e.account_id = a.id
      GROUP BY a.id, a.balance_cents
     HAVING a.balance_cents <> COALESCE(SUM(e.amount_cents), 0)`,
  );
  const [{ total }] = await db.query(
    `SELECT COALESCE(SUM(amount_cents), 0)::text AS total FROM app.ledger_entries`,
  );
  const broken: { id: string }[] = await db.query(
    `SELECT id::text FROM (
       SELECT id, balance_after_cents,
              SUM(amount_cents) OVER (PARTITION BY account_id ORDER BY created_at, id) AS running
         FROM app.ledger_entries) t
      WHERE balance_after_cents <> running`,
  );
  const [{ gap }] = await db.query(
    `SELECT (SELECT balance_cents FROM app.accounts WHERE type = 'SYSTEM')
          + (SELECT COALESCE(SUM(balance_cents), 0) FROM app.accounts WHERE type = 'USER') AS gap`,
  );
  return {
    mismatchedBalances: mismatched.map((row) => row.id),
    globalSum: total,
    brokenChain: broken.map((row) => row.id),
    treasuryGap: String(gap),
  };
}

/** La conciliación perfecta: nada desbalanceado y todo suma cero. */
export const RECONCILED: Reconciliation = {
  mismatchedBalances: [],
  globalSum: '0',
  brokenChain: [],
  treasuryGap: '0',
};
