import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  authed,
  balanceOf,
  confirmTransfer,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';

const harness = useIntegrationHarness();

interface Scene {
  readonly t: TestApp;
  readonly ana: LedgerUser;
  readonly luis: LedgerUser;
  readonly body: Record<string, unknown>;
}

async function scene(now: string, amount: string): Promise<Scene> {
  const t = await buildTestApp(harness, { now });
  const ana = await ledgerUser(t, harness);
  const luis = await ledgerUser(t, harness);
  const beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
  await fund(t, ana.principal.id, '40000.00');
  const body = {
    fromAccountId: ana.principal.id,
    destination: { type: 'BENEFICIARY', beneficiaryId },
    amount,
    concept: 'Enganche',
    reference: '42',
  };
  return { t, ana, luis, body };
}

describe('TRF-19 vencimiento del OTP', () => {
  it('TRF-19 confirmar a los 6 minutos responde 409 TRANSFER_EXPIRED, no mueve dinero y la consulta muestra EXPIRED', async () => {
    const { t, ana, luis, body } = await scene('2026-10-13T18:00:00.000Z', '15000.00');
    const key = randomUUID();
    const created = await postTransfer(t, ana, body, key);
    const code = t.mailer.lastCode(ana.person.email);
    t.clock.advance(6 * 60_000);
    const res = await confirmTransfer(t, ana, created.body.id, { otp: code });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TRANSFER_EXPIRED');
    expect(await balanceOf(harness, ana.principal.id)).toBe('40000.00');
    expect(await balanceOf(harness, luis.principal.id)).toBe('0.00');
    // Consulta del estado actual por la API: el reintento con la misma llave lo devuelve (la
    // consulta por id, GET /transfers/{transferId}, se agrega en la sección 8).
    const replay = await postTransfer(t, ana, body, key);
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({ id: created.body.id, status: 'EXPIRED', otp: null });
    const [row] = await harness.migrator.query('SELECT status FROM app.transfers WHERE id = $1', [
      created.body.id,
    ]);
    expect(row.status).toBe('PENDING_OTP');
  });

  it('TRF-19 a los 4:59.999 sigue pendiente y se confirma; a los 5:00 exactos se informa EXPIRED', async () => {
    const { t, ana, body } = await scene('2026-10-13T18:00:00.000Z', '15000.00');
    const ok = await postTransfer(t, ana, body);
    const okCode = t.mailer.lastCode(ana.person.email);
    const lateKey = randomUUID();
    const lateBody = { ...body, reference: '43' };
    const late = await postTransfer(t, ana, lateBody, lateKey);
    const lateCode = t.mailer.lastCode(ana.person.email);

    t.clock.advance(299_999);
    expect((await postTransfer(t, ana, lateBody, lateKey)).body.status).toBe('PENDING_OTP');
    expect((await confirmTransfer(t, ana, ok.body.id, { otp: okCode })).status).toBe(200);

    t.clock.advance(1);
    expect((await postTransfer(t, ana, lateBody, lateKey)).body.status).toBe('EXPIRED');
    const expired = await confirmTransfer(t, ana, late.body.id, { otp: lateCode });
    expect(expired.status).toBe(409);
    expect(expired.body.code).toBe('TRANSFER_EXPIRED');
  });
});

describe('TRF-12 OTP que cruza la medianoche de CDMX', () => {
  it('TRF-12 creada a las 23:58 y confirmada a las 00:02 consume el límite del día nuevo', async () => {
    const { t, ana, body } = await scene('2026-10-14T05:58:00.000Z', '30000.00'); // 23:58 CDMX
    const created = await postTransfer(t, ana, body);
    expect(created.body.status).toBe('PENDING_OTP');
    const code = t.mailer.lastCode(ana.person.email);
    t.clock.set('2026-10-14T06:02:00.000Z'); // 00:02 CDMX
    const res = await confirmTransfer(t, ana, created.body.id, { otp: code });
    expect(res.status).toBe(200);
    expect(res.body.completedAt).toBe('2026-10-14T06:02:00.000Z');
    const usage = await harness.migrator.query(
      `SELECT day::text AS day, used_cents FROM app.daily_transfer_usage
        WHERE user_id = $1 ORDER BY day`,
      [ana.userId],
    );
    expect(usage).toEqual([
      { day: '2026-10-13', used_cents: '0' },
      { day: '2026-10-14', used_cents: '3000000' },
    ]);
    const accounts = await authed(t, ana.accessToken).get('/accounts');
    expectToMatchContract(accounts, 'listAccounts');
    expect(accounts.body.dailyLimit).toMatchObject({ used: '30000.00', remaining: '20000.00' });
  });
});
