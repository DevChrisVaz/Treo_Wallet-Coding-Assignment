import type { IncomingMessage } from 'node:http';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { authed, fund, ledgerUser } from '../../helpers/ledger-api.js';
import { linesOf, pdfPages } from '../../helpers/pdf.js';
import { RECONCILED, reconcile } from '../../helpers/reconciliation.js';

const harness = useIntegrationHarness();

const MOVEMENTS = 5_000;

/**
 * 5,000 traspasos completados entre "Principal" y "Ahorro" en septiembre de 2026, con
 * `generate_series` como el seed: los impares salen de "Principal" y los pares regresan, así que
 * cada uno es un asiento de "Principal". El `balance_after` se calcula con una función de ventana
 * antes de insertar (los asientos son inmutables) y los ids siguen el orden cronológico.
 */
const VOLUME_SQL = `
WITH plan AS (
  SELECT i, gen_random_uuid() AS transfer_id,
         timestamptz '2026-09-01 06:00:00+00' + i * interval '8 minutes' AS at,
         i % 2 = 1 AS outgoing
    FROM generate_series(1, ${MOVEMENTS}) AS i
), transfers AS (
  INSERT INTO app.transfers (id, user_id, idempotency_key, request_fingerprint, kind, status,
                             from_account_id, to_account_id, amount_cents, concept, reference,
                             requires_otp, created_at, completed_at)
  SELECT transfer_id, $1, gen_random_uuid(), repeat('a', 64), 'OWN', 'COMPLETED',
         CASE WHEN outgoing THEN $2::uuid ELSE $3::uuid END,
         CASE WHEN outgoing THEN $3::uuid ELSE $2::uuid END,
         10000, 'Traspaso ' || i, i, false, at, at
    FROM plan
  RETURNING id
), entries AS (
  SELECT p.i, p.transfer_id, p.at, side.account_id, side.type, side.amount_cents, side.side
    FROM plan p
   CROSS JOIN LATERAL (VALUES
     (0, CASE WHEN p.outgoing THEN $2::uuid ELSE $3::uuid END,
         'OWN_TRANSFER_OUT', -10000::bigint),
     (1, CASE WHEN p.outgoing THEN $3::uuid ELSE $2::uuid END, 'OWN_TRANSFER_IN', 10000::bigint)
   ) AS side(side, account_id, type, amount_cents)
)
INSERT INTO app.ledger_entries (transfer_id, account_id, type, amount_cents, balance_after_cents,
                                created_at)
SELECT e.transfer_id, e.account_id, e.type, e.amount_cents,
       a.balance_cents + SUM(e.amount_cents) OVER (PARTITION BY e.account_id ORDER BY e.i, e.side),
       e.at
  FROM entries e
  JOIN app.accounts a ON a.id = e.account_id
 WHERE (SELECT count(*) FROM transfers) = ${MOVEMENTS}
 ORDER BY e.i, e.side`;

function bodyParser(
  res: request.Response,
  callback: (error: Error | null, body: unknown) => void,
): void {
  const stream = res as unknown as IncomingMessage;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
}

describe('HIS-12 estado de cuenta con volumen', () => {
  it('HIS-12 un mes con 5000 movimientos responde en menos de 5 s, en varias páginas con encabezados y "Página N de N"', async ({
    annotate,
  }) => {
    const t = await buildTestApp(harness, { now: '2026-09-01T05:50:00.000Z' });
    const ana = await ledgerUser(t, harness);
    await fund(t, ana.principal.id, '1000000.00'); // 31 de agosto: saldo inicial de septiembre
    await harness.migrator.transaction(async (manager) => {
      await manager.query(VOLUME_SQL, [ana.userId, ana.principal.id, ana.ahorro.id]);
      await manager.query(
        `UPDATE app.accounts a
            SET balance_cents = (SELECT e.balance_after_cents FROM app.ledger_entries e
                                  WHERE e.account_id = a.id ORDER BY e.created_at DESC, e.id DESC
                                  LIMIT 1)
          WHERE a.id = ANY($1)`,
        [[ana.principal.id, ana.ahorro.id]],
      );
    });
    expect(await reconcile(harness.migrator)).toEqual(RECONCILED);

    t.clock.set('2026-10-14T18:00:00.000Z');
    const login = await request(t.app)
      .post('/auth/login')
      .send({ email: ana.person.email.toLowerCase(), password: ana.person.password });
    const token = login.body.tokens.accessToken as string;

    const started = performance.now();
    const res = await authed(t, token)
      .get(`/accounts/${ana.principal.id}/statements/2026-09`)
      .buffer(true)
      .parse(bodyParser);
    const elapsed = performance.now() - started;
    expect(res.status).toBe(200);
    expect(elapsed).toBeLessThan(5_000);

    const bytes = res.body as Buffer;
    const pages = await pdfPages(bytes);
    expect(pages.length).toBeGreaterThan(1);
    pages.forEach((page, index) => {
      const lines = linesOf(page);
      expect(lines).toContain('Fecha Tipo Descripción Cargo Abono Saldo');
      expect(lines).toContain(`Página ${index + 1} de ${pages.length}`);
    });
    expect(linesOf(pages.at(-1) ?? '')).toContain(`Página ${pages.length} de ${pages.length}`);
    const rows = pages.flatMap(linesOf).filter((line) => /^[0-9]{2}\/09\/2026 /.test(line));
    expect(rows).toHaveLength(MOVEMENTS);
    const lines = linesOf(pages[0] ?? '');
    expect(lines).toContain('Saldo inicial $1,000,000.00');
    expect(lines).toContain('Abonos $250,000.00');
    expect(lines).toContain('Cargos $250,000.00');
    expect(lines).toContain('Saldo final $1,000,000.00');

    await annotate(
      `${MOVEMENTS} movimientos: ${Math.round(elapsed)} ms, ${(bytes.length / 1024).toFixed(0)} KB, ${pages.length} páginas`,
    );
  }, 120_000);
});
