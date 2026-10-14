import { createHash, randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { auditEvents, leakedValues } from '../../helpers/audit.js';
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
  // 14 de octubre de 2026, 12:00 en la Ciudad de México.
  t = await buildTestApp(harness, { now: '2026-10-14T18:00:00.000Z' });
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
});

const toLuis = (amount: string, scheduledFor?: string) => ({
  fromAccountId: ana.principal.id,
  destination: { type: 'BENEFICIARY', beneficiaryId },
  amount,
  concept: 'Renta',
  reference: '1234',
  ...(scheduledFor === undefined ? {} : { scheduledFor }),
});

async function countOf(table: 'ledger_entries' | 'daily_transfer_usage'): Promise<number> {
  const [{ n }] = await harness.migrator.query(`SELECT count(*)::int AS n FROM app.${table}`);
  return n;
}

async function userTransfers(): Promise<number> {
  const [{ n }] = await harness.migrator.query(
    `SELECT count(*)::int AS n FROM app.transfers WHERE user_id = $1`,
    [ana.userId],
  );
  return n;
}

describe('TRF-27 programación de una transferencia', () => {
  it('TRF-28 exactamente 10000.00 programada queda SCHEDULED sin OTP: ni código ni correo', async () => {
    const mailsBefore = t.mailer.to(ana.person.email).length;
    const res = await postTransfer(t, ana, toLuis('10000.00', '2026-10-15'));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'SCHEDULED',
      amount: '10000.00',
      requiresOtp: false,
      otp: null,
    });
    // El umbral es estricto: solo lo que lo supera pide OTP.
    const [{ n }] = await harness.migrator.query(
      `SELECT count(*)::int AS n FROM app.one_time_codes WHERE purpose = 'TRANSFER_CONFIRMATION'`,
    );
    expect(n).toBe(0);
    expect(t.mailer.to(ana.person.email)).toHaveLength(mailsBefore);
  });

  it('TRF-27 programar para mañana: 201 SCHEDULED con scheduledFor, sin asientos y sin tocar saldo ni límite', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const entriesBefore = await countOf('ledger_entries');
    const res = await postTransfer(t, ana, toLuis('1000.00', '2026-10-15'));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'SCHEDULED',
      kind: 'THIRD_PARTY',
      amount: '1000.00',
      scheduledFor: '2026-10-15',
      requiresOtp: false,
      otp: null,
      rejectionReason: null,
      failureReason: null,
      cancelledAt: null,
      completedAt: null,
      createdAt: '2026-10-14T18:00:00.000Z',
    });
    expect(await balanceOf(harness, ana.principal.id)).toBe('5000.00');
    expect(await balanceOf(harness, luis.principal.id)).toBe('0.00');
    expect(await countOf('ledger_entries')).toBe(entriesBefore);
    expect(await countOf('daily_transfer_usage')).toBe(0);
    const [row] = await harness.migrator.query(
      `SELECT status, scheduled_for::text AS scheduled_for, cancelled_at, completed_at
         FROM app.transfers WHERE id = $1`,
      [res.body.id],
    );
    expect(row).toEqual({
      status: 'SCHEDULED',
      scheduled_for: '2026-10-15',
      cancelled_at: null,
      completed_at: null,
    });
  });

  it('TRF-27 sin saldo suficiente hoy también se programa: el saldo se valida al ejecutar', async () => {
    await fund(t, ana.principal.id, '100.00');
    const res = await postTransfer(t, ana, toLuis('1000.00', '2026-10-15'));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SCHEDULED');
    expect(await balanceOf(harness, ana.principal.id)).toBe('100.00');
  });

  it('TRF-27 con el límite de hoy agotado también se programa: el límite es el del día de ejecución', async () => {
    await harness.migrator.query(
      `INSERT INTO app.daily_transfer_usage (user_id, day, used_cents, limit_cents)
       VALUES ($1, '2026-10-14', 5000000, 5000000)`,
      [ana.userId],
    );
    const res = await postTransfer(t, ana, toLuis('1000.00', '2026-10-15'));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SCHEDULED');
  });

  it('TRF-27 programar entre cuentas propias: 201 SCHEDULED con kind OWN', async () => {
    const res = await postTransfer(t, ana, {
      fromAccountId: ana.principal.id,
      destination: { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id },
      amount: '5000.00',
      concept: 'Ahorro',
      reference: '1',
      scheduledFor: '2026-10-20',
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'SCHEDULED',
      kind: 'OWN',
      scheduledFor: '2026-10-20',
    });
  });

  it('TRF-27 a 90 días es el último día programable', async () => {
    const res = await postTransfer(t, ana, toLuis('10.00', '2027-01-12'));
    expect(res.status).toBe(201);
    expect(res.body.scheduledFor).toBe('2027-01-12');
  });

  it.each([
    ['la fecha de hoy', '2026-10-14'],
    ['ayer', '2026-10-13'],
    ['más de 90 días', '2027-01-13'],
  ])('TRF-27 %s es 422 DATE_OUT_OF_RANGE en /scheduledFor y no guarda nada', async (_case, day) => {
    const res = await postTransfer(t, ana, toLuis('1000.00', day));
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [{ pointer: '/scheduledFor', code: 'DATE_OUT_OF_RANGE' }],
    });
    expect(await userTransfers()).toBe(0);
  });

  it.each([
    ['un día que no existe', '2026-02-30', 'INVALID_DATE'],
    ['un mes que no existe', '2026-13-01', 'INVALID_DATE'],
    ['otro formato', '15/10/2026', 'INVALID_FORMAT'],
    ['un número', 20261015, 'INVALID_TYPE'],
  ])('TRF-27 %s es 422 VALIDATION_FAILED con %s en /scheduledFor', async (_case, day, code) => {
    const res = await postTransfer(t, ana, { ...toLuis('1000.00'), scheduledFor: day });
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [{ pointer: '/scheduledFor', code }],
    });
    expect(await userTransfers()).toBe(0);
  });

  it('TRF-27 a un tercero por más del límite diario es 422 TOO_LARGE en /amount: nunca podría ejecutarse', async () => {
    const res = await postTransfer(t, ana, toLuis('50000.01', '2026-10-15'));
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [{ pointer: '/amount', code: 'TOO_LARGE' }],
    });
    expect(await userTransfers()).toBe(0);
  });

  it('TRF-27 fecha fuera de rango y monto mayor al límite se informan juntos', async () => {
    const res = await postTransfer(t, ana, toLuis('60000.00', '2026-10-14'));
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([
      expect.objectContaining({ pointer: '/scheduledFor', code: 'DATE_OUT_OF_RANGE' }),
      expect.objectContaining({ pointer: '/amount', code: 'TOO_LARGE' }),
    ]);
  });

  it('TRF-27 las validaciones de una inmediata aplican igual: origen ajeno es 404 y misma cuenta 422', async () => {
    const foreign = await postTransfer(t, ana, {
      ...toLuis('100.00', '2026-10-15'),
      fromAccountId: luis.principal.id,
    });
    expect(foreign.status).toBe(404);
    expect(foreign.body.code).toBe('NOT_FOUND');
    const same = await postTransfer(t, ana, {
      fromAccountId: ana.principal.id,
      destination: { type: 'OWN_ACCOUNT', accountId: ana.principal.id },
      amount: '100.00',
      concept: 'Nada',
      reference: '1',
      scheduledFor: '2026-10-15',
    });
    expect(same.status).toBe(422);
    expect(same.body.code).toBe('SAME_ACCOUNT_TRANSFER');
    const decimals = await postTransfer(t, ana, toLuis('100.005', '2026-10-15'));
    expect(decimals.status).toBe(422);
    expect(decimals.body.errors).toEqual([expect.objectContaining({ pointer: '/amount' })]);
    expect(await userTransfers()).toBe(0);
  });
});

describe('TRF-36 auditoría al programar', () => {
  it('TRF-36 deja TRANSFER_CREATED con el estado inicial y TRANSFER_SCHEDULED, con monto y fecha y sin datos personales', async () => {
    const res = await postTransfer(t, ana, toLuis('1000.00', '2026-10-15'));
    expect(res.status).toBe(201);
    const events = (await auditEvents(harness.migrator)).filter(
      (event) => event.entity_id === res.body.id,
    );
    expect(events).toEqual([
      expect.objectContaining({
        action: 'TRANSFER_CREATED',
        actor_type: 'USER',
        actor_user_id: ana.userId,
        entity_type: 'transfer',
        metadata: {
          status: 'SCHEDULED',
          kind: 'THIRD_PARTY',
          amount: '1000.00',
          scheduledFor: '2026-10-15',
        },
      }),
      expect.objectContaining({
        action: 'TRANSFER_SCHEDULED',
        actor_type: 'USER',
        actor_user_id: ana.userId,
        metadata: { kind: 'THIRD_PARTY', amount: '1000.00', scheduledFor: '2026-10-15' },
      }),
    ]);
    expect(
      leakedValues(events, [
        ana.person.email,
        ana.person.fullName,
        luis.principal.clabe,
        ana.principal.clabe,
        'Luis Pérez',
        'Renta',
      ]),
    ).toEqual([]);
  });
});

describe('TRF-29 idempotencia de las programadas', () => {
  it('TRF-29 el reintento de una programación responde 200 con la misma transferencia e Idempotent-Replayed', async () => {
    const key = randomUUID();
    const first = await postTransfer(t, ana, toLuis('1000.00', '2026-10-15'), key);
    const retry = await postTransfer(t, ana, toLuis('1000.00', '2026-10-15'), key);
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect(retry.body).toMatchObject({ id: first.body.id, status: 'SCHEDULED' });
    expect(await userTransfers()).toBe(1);
  });

  it('TRF-29 la misma llave con otra fecha es 422 IDEMPOTENCY_KEY_REUSED', async () => {
    const key = randomUUID();
    await postTransfer(t, ana, toLuis('1000.00', '2026-10-15'), key);
    const reused = await postTransfer(t, ana, toLuis('1000.00', '2026-10-16'), key);
    expect(reused.status).toBe(422);
    expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await userTransfers()).toBe(1);
  });

  it('TRF-29 la llave de una inmediata usada con fecha es 422 IDEMPOTENCY_KEY_REUSED', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const key = randomUUID();
    await postTransfer(t, ana, toLuis('1000.00'), key);
    const reused = await postTransfer(t, ana, toLuis('1000.00', '2026-10-15'), key);
    expect(reused.status).toBe(422);
    expect(reused.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
    expect(await balanceOf(harness, ana.principal.id)).toBe('4000.00');
  });

  it('TRF-29 la huella de una inmediata sigue la fórmula anterior y su reintento es 200 con la original', async () => {
    await fund(t, ana.principal.id, '5000.00');
    const key = randomUUID();
    const first = await postTransfer(t, ana, toLuis('1000.5'), key);
    // Fórmula de api-ledger, escrita aquí aparte del código: seis valores, sin fecha.
    const legacy = createHash('sha256')
      .update(
        JSON.stringify([ana.principal.id, 'BENEFICIARY', beneficiaryId, '100050', 'Renta', '1234']),
      )
      .digest('hex');
    const [row] = await harness.migrator.query(
      `SELECT request_fingerprint FROM app.transfers WHERE id = $1`,
      [first.body.id],
    );
    expect(row.request_fingerprint).toBe(legacy);
    const retry = await postTransfer(t, ana, toLuis('1000.50'), key);
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({
      id: first.body.id,
      status: 'COMPLETED',
      scheduledFor: null,
    });
  });

  it('TRF-02 una fecha fuera de rango no consume la llave', async () => {
    const key = randomUUID();
    const invalid = await postTransfer(t, ana, toLuis('1000.00', '2026-10-14'), key);
    expect(invalid.status).toBe(422);
    const valid = await postTransfer(t, ana, toLuis('1000.00', '2026-10-15'), key);
    expect(valid.status).toBe(201);
    expect(valid.headers['idempotent-replayed']).toBeUndefined();
  });

  it('TRF-29 un reintento que cruza la medianoche se reconoce como reintento y no como fecha vencida', async () => {
    t = await buildTestApp(harness, { now: '2026-10-15T05:58:00.000Z' }); // 23:58 del 14 en CDMX
    ana = await ledgerUser(t, harness);
    luis = await ledgerUser(t, harness);
    beneficiaryId = await addBeneficiary(t, ana, {
      name: 'Luis Pérez',
      alias: 'Luis',
      clabe: luis.principal.clabe,
    });
    t.clock.set('2026-10-15T05:59:00.000Z'); // 23:59 del 14
    const key = randomUUID();
    const first = await postTransfer(t, ana, toLuis('1000.00', '2026-10-15'), key);
    expect(first.status).toBe(201);
    t.clock.set('2026-10-15T06:00:30.000Z'); // 00:00:30 del 15: el 15 ya no es programable
    const retry = await postTransfer(t, ana, toLuis('1000.00', '2026-10-15'), key);
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ id: first.body.id, scheduledFor: '2026-10-15' });
  });
});
