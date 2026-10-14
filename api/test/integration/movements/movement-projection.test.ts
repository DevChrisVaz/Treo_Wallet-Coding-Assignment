import { beforeEach, describe, expect, it } from 'vitest';
import {
  projectMovementsSql,
  toMovementRecord,
  type MovementRow,
} from '../../../src/modules/movements/infrastructure/movement-projection.js';
import { PgMovementReader } from '../../../src/modules/movements/infrastructure/pg-movement-reader.js';
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

beforeEach(async () => {
  t = await buildTestApp(harness, { now: '2026-09-15T18:00:00.000Z' });
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
});

async function send(from: LedgerUser, destination: Record<string, string>, amount: string) {
  t.clock.advance(1_000);
  const res = await postTransfer(t, from, {
    fromAccountId: from.principal.id,
    destination,
    amount,
    concept: 'Pago',
    reference: '42',
  });
  expect(res.status).toBe(201);
}

describe('HIS-12 proyección de asiento a movimiento compartida con el historial', () => {
  it('HIS-12 en orden ascendente proyecta exactamente los mismos movimientos que el historial (HIS-03)', async () => {
    await fund(t, ana.principal.id, '1000.00');
    await fund(t, luis.principal.id, '1000.00');
    const toLuis = await addBeneficiary(t, ana, {
      name: 'Luis Pérez',
      alias: 'Luis',
      clabe: luis.principal.clabe,
    });
    const toAna = await addBeneficiary(t, luis, {
      name: 'Ana',
      alias: 'Ana',
      clabe: ana.principal.clabe,
    });
    await send(ana, { type: 'BENEFICIARY', beneficiaryId: toLuis }, '150.00');
    await send(ana, { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id }, '200.00');
    await send(luis, { type: 'BENEFICIARY', beneficiaryId: toAna }, '500.00');

    const history = await new PgMovementReader(harness.app).page({
      accountId: ana.principal.id,
      types: [],
      limit: 100,
    });
    const rows: MovementRow[] = await harness.app.query(
      projectMovementsSql(
        `SELECT e.* FROM ledger_entries e WHERE e.account_id = $1 ORDER BY e.created_at, e.id`,
        'ASC',
      ),
      [ana.principal.id],
    );

    expect(history.map((row) => row.type)).toEqual([
      'TRANSFER_IN',
      'OWN_TRANSFER_OUT',
      'TRANSFER_OUT',
      'DEPOSIT',
    ]);
    expect(rows.map(toMovementRecord)).toEqual([...history].reverse());
  });
});
