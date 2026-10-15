import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, testRateLimits, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  authed,
  confirmTransfer,
  fund,
  ledgerUser,
  postTransfer,
  resendTransferOtp,
  type LedgerUser,
} from '../../helpers/ledger-api.js';
import { signInAgain } from '../../helpers/scheduled.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let beneficiaryId: string;

beforeEach(async () => {
  t = await buildTestApp(harness, {
    now: '2026-10-13T18:00:00.000Z',
    config: {
      rateLimits: testRateLimits({
        transferConfirmMax: 2,
        transferResendMax: 2,
        transferCancelMax: 2,
        transferCreateMax: 50,
      }),
    },
  });
  ana = await ledgerUser(t, harness);
  const luis = await ledgerUser(t, harness);
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
  await fund(t, ana.principal.id, '50000.00');
});

async function pending(amount = '15000.00') {
  const res = await postTransfer(t, ana, {
    fromAccountId: ana.principal.id,
    destination: { type: 'BENEFICIARY', beneficiaryId },
    amount,
    concept: 'Enganche',
    reference: '42',
  });
  expect(res.body.status).toBe('PENDING_OTP');
  return res.body.id as string;
}

async function statusOf(id: string): Promise<string> {
  const [row] = await harness.migrator.query(`SELECT status FROM app.transfers WHERE id = $1`, [
    id,
  ]);
  return row.status as string;
}

describe('TRF-37 límite de confirmaciones', () => {
  it('TRF-37 la confirmación que excede el tope responde 429 y la transferencia sigue pendiente', async () => {
    const id = await pending();
    const code = t.mailer.lastCode(ana.person.email);
    const wrong = code === '000000' ? '000001' : '000000';
    expect((await confirmTransfer(t, ana, id, { otp: wrong })).status).toBe(422);
    expect((await confirmTransfer(t, ana, id, { otp: wrong })).status).toBe(422);
    const res = await confirmTransfer(t, ana, id, { otp: code });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(await statusOf(id)).toBe('PENDING_OTP');
  });

  it('TRF-37 la ventana de 15 minutos se reinicia y la confirmación vuelve a llegar al caso de uso', async () => {
    const id = await pending();
    const code = t.mailer.lastCode(ana.person.email);
    for (let i = 0; i < 3; i += 1) await confirmTransfer(t, ana, id, { otp: '999999' });
    t.clock.advance(15 * 60_000 - 60_000);
    const again = await signInAgain(t, ana);
    expect((await confirmTransfer(t, again, id, { otp: code })).status).toBe(429);
    t.clock.advance(60_000);
    const later = await signInAgain(t, ana);
    // El código vence a los 5 minutos: la respuesta ya no es 429, sino la del caso de uso.
    expect((await confirmTransfer(t, later, id, { otp: code })).status).toBe(409);
  });
});

describe('TRF-37 límite de reenvíos del código', () => {
  it('TRF-37 el reenvío que excede el tope responde 429 sin enviar otro código', async () => {
    const id = await pending();
    expect((await resendTransferOtp(t, ana, id)).status).toBe(202);
    expect((await resendTransferOtp(t, ana, id)).status).toBe(202);
    const sent = t.mailer.to(ana.person.email).length;
    const res = await resendTransferOtp(t, ana, id);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(t.mailer.to(ana.person.email)).toHaveLength(sent);
  });
});

describe('TRF-37 límite de cancelaciones', () => {
  it('TRF-37 la cancelación que excede el tope responde 429 y la programada sigue programada', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const res = await postTransfer(t, ana, {
        fromAccountId: ana.principal.id,
        destination: { type: 'BENEFICIARY', beneficiaryId },
        amount: '100.00',
        concept: 'Renta',
        reference: String(i + 1),
        scheduledFor: '2026-10-14T06:00:00.000Z',
      });
      expect(res.status).toBe(201);
      ids.push(res.body.id as string);
    }
    for (const id of ids.slice(0, 2)) {
      expect((await authed(t, ana.accessToken).post(`/transfers/${id}/cancel`)).status).toBe(200);
    }
    const res = await authed(t, ana.accessToken).post(`/transfers/${ids[2]}/cancel`);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(await statusOf(ids[2] as string)).toBe('SCHEDULED');
  });
});

describe('TRF-37 contadores independientes por operación', () => {
  it('TRF-37 agotar las confirmaciones no impide reenviar ni cancelar', async () => {
    const id = await pending();
    for (let i = 0; i < 3; i += 1) await confirmTransfer(t, ana, id, { otp: '999999' });
    expect((await confirmTransfer(t, ana, id, { otp: '999999' })).status).toBe(429);
    expect((await resendTransferOtp(t, ana, id)).status).toBe(202);
    expect((await authed(t, ana.accessToken).post(`/transfers/${id}/cancel`)).status).not.toBe(429);
  });
});
