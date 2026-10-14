import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  balanceOf,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;
let beneficiaryId: string;

beforeEach(async () => {
  t = await buildTestApp(harness);
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
});

const toLuis = (amount: unknown, extra: Record<string, unknown> = {}) => ({
  fromAccountId: ana.principal.id,
  destination: { type: 'BENEFICIARY', beneficiaryId },
  amount,
  concept: 'Renta',
  reference: '1234567',
  ...extra,
});

async function transferCount(): Promise<number> {
  const [{ n }] = await harness.migrator.query(
    `SELECT count(*)::int AS n FROM app.transfers WHERE kind <> 'FUNDING'`,
  );
  return n;
}

describe('TRF-01 creación de transferencias', () => {
  it('TRF-01 Ana con 5000.00 envía 1250.50 a Luis: 201 COMPLETED THIRD_PARTY y saldos exactos', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const res = await postTransfer(t, ana, toLuis('1250.50'));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'COMPLETED', kind: 'THIRD_PARTY', amount: '1250.50' });
    expect(res.body.completedAt).toEqual(expect.any(String));
    expect(await balanceOf(harness, ana.principal.id)).toBe('3749.50');
    expect(await balanceOf(harness, luis.principal.id)).toBe('1250.50');
  });

  it('TRF-01 de "Principal" a "Ahorro" responde 201 COMPLETED OWN', async () => {
    await fund(t, ana.principal.id, '600.00');
    const res = await postTransfer(t, ana, {
      ...toLuis('500.00'),
      destination: { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id },
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'COMPLETED', kind: 'OWN' });
  });
});

describe('TRF-10 saldo', () => {
  it('TRF-10 con saldo 100.00 enviar 150.00 es 422 INSUFFICIENT_FUNDS, REJECTED y saldo intacto', async () => {
    await fund(t, ana.principal.id, '100.00');
    const res = await postTransfer(t, ana, toLuis('150.00'));
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ code: 'INSUFFICIENT_FUNDS', transferId: expect.any(String) });
    const [row] = await harness.migrator.query('SELECT status FROM app.transfers WHERE id = $1', [
      res.body.transferId,
    ]);
    expect(row.status).toBe('REJECTED');
    expect(await balanceOf(harness, ana.principal.id)).toBe('100.00');
  });

  it('TRF-10 con saldo 100.00 enviar exactamente 100.00 se completa y deja 0.00', async () => {
    await fund(t, ana.principal.id, '100.00');
    const res = await postTransfer(t, ana, toLuis('100.00'));
    expect(res.status).toBe(201);
    expect(await balanceOf(harness, ana.principal.id)).toBe('0.00');
  });
});

describe('TRF-07 a TRF-09 validación sin efectos', () => {
  it('TRF-07 la misma cuenta como origen y destino es 422 SAME_ACCOUNT_TRANSFER sin crear nada', async () => {
    await fund(t, ana.principal.id, '100.00');
    const res = await postTransfer(t, ana, {
      ...toLuis('10.00'),
      destination: { type: 'OWN_ACCOUNT', accountId: ana.principal.id },
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('SAME_ACCOUNT_TRANSFER');
    expect(await transferCount()).toBe(0);
  });

  it.each([
    ['"100.005"', '100.005'],
    ['el número JSON 1250.5', 1250.5],
    ['"0.00"', '0.00'],
  ])(
    'TRF-08 el monto %s responde 422 VALIDATION_FAILED en /amount sin crear nada',
    async (_case, amount) => {
      await fund(t, ana.principal.id, '5000.00');
      const res = await postTransfer(t, ana, toLuis(amount));
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.errors[0].pointer).toBe('/amount');
      expect(await transferCount()).toBe(0);
      expect(await balanceOf(harness, ana.principal.id)).toBe('5000.00');
    },
  );

  it('TRF-21 una transferencia hecha por la API deja dos asientos, -X en el origen y +X en el destino, con su transferId', async () => {
    await fund(t, ana.principal.id, '2000.00');
    const res = await postTransfer(t, ana, toLuis('1250.50'));
    expect(res.status).toBe(201);
    const entries = await harness.migrator.query(
      'SELECT transfer_id, account_id, amount_cents FROM app.ledger_entries WHERE transfer_id = $1 ORDER BY amount_cents',
      [res.body.id],
    );
    expect(entries).toEqual([
      { transfer_id: res.body.id, account_id: ana.principal.id, amount_cents: '-125050' },
      { transfer_id: res.body.id, account_id: luis.principal.id, amount_cents: '125050' },
    ]);
  });

  it('TRF-08 "1250.5" descuenta exactamente 125050 centavos y se muestra como "1250.50"', async () => {
    await fund(t, ana.principal.id, '2000.00');
    const res = await postTransfer(t, ana, toLuis('1250.5'));
    expect(res.body.amount).toBe('1250.50');
    const [entry] = await harness.migrator.query(
      'SELECT amount_cents FROM app.ledger_entries WHERE transfer_id = $1 AND amount_cents < 0',
      [res.body.id],
    );
    expect(entry.amount_cents).toBe('-125050');
  });

  it('TRF-09 una referencia con letras es 422 VALIDATION_FAILED en /reference', async () => {
    const res = await postTransfer(t, ana, toLuis('10.00', { reference: '12A' }));
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors[0].pointer).toBe('/reference');
  });

  it('TRF-02 sin llave responde 400 IDEMPOTENCY_KEY_MISSING y no crea nada', async () => {
    await fund(t, ana.principal.id, '100.00');
    const res = await postTransfer(t, ana, toLuis('10.00'), null);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_MISSING');
    expect(await transferCount()).toBe(0);
  });

  it('TRF-02 una llave usada en una petición inválida sirve después para la petición válida', async () => {
    await fund(t, ana.principal.id, '100.00');
    const key = randomUUID();
    const invalid = await postTransfer(t, ana, toLuis('100.005'), key);
    expect(invalid.status).toBe(422);
    const valid = await postTransfer(t, ana, toLuis('10.00'), key);
    expect(valid.status).toBe(201);
    expect(valid.headers['idempotent-replayed']).toBeUndefined();
  });
});
