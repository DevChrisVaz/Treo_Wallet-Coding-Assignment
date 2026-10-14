import { beforeEach, describe, expect, it } from 'vitest';
import { auditEvents } from '../../helpers/audit.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { wrongCode } from '../../helpers/identity.js';
import {
  addBeneficiary,
  confirmTransfer,
  fund,
  ledgerUser,
  postTransfer,
  resendTransferOtp,
  type LedgerUser,
} from '../../helpers/ledger-api.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;
let beneficiaryId: string;

beforeEach(async () => {
  t = await buildTestApp(harness, { now: '2026-10-13T18:00:00.000Z' });
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
  await fund(t, ana.principal.id, '20000.00');
});

async function pending() {
  const res = await postTransfer(t, ana, {
    fromAccountId: ana.principal.id,
    destination: { type: 'BENEFICIARY', beneficiaryId },
    amount: '15000.00',
    concept: 'Enganche',
    reference: '42',
  });
  expect(res.body.status).toBe('PENDING_OTP');
  return { id: res.body.id as string, code: t.mailer.lastCode(ana.person.email) };
}

async function state(id: string) {
  const [row] = await harness.migrator.query(
    `SELECT t.otp_expires_at, c.attempts, c.resend_count, c.expires_at, c.code_hash
       FROM app.transfers t JOIN app.one_time_codes c ON c.subject_id = t.id
      WHERE t.id = $1`,
    [id],
  );
  return row;
}

describe('TRF-20 reenvío del OTP', () => {
  it('TRF-20 emite un código nuevo: 202 con intentos reiniciados, vigencia nueva y un reenvío menos', async () => {
    const { id, code } = await pending();
    await confirmTransfer(t, ana, id, { otp: wrongCode(code) });
    const before = await state(id);
    t.clock.advance(2 * 60_000);
    const res = await resendTransferOtp(t, ana, id);
    expect(res.status).toBe(202);
    expect(res.body).toEqual({
      channel: 'EMAIL',
      deliveryStatus: 'SENT',
      maskedDestination: expect.stringMatching(/\*\*\*@example\.com$/),
      expiresAt: '2026-10-13T18:07:00.000Z',
      attemptsRemaining: 3,
      resendsRemaining: 2,
    });
    const after = await state(id);
    expect(after).toMatchObject({
      otp_expires_at: new Date('2026-10-13T18:07:00.000Z'),
      expires_at: new Date('2026-10-13T18:07:00.000Z'),
      attempts: 0,
      resend_count: 1,
    });
    expect(after.code_hash).not.toBe(before.code_hash);
    const newCode = t.mailer.lastCode(ana.person.email);
    expect(JSON.stringify(res.body)).not.toContain(newCode);
    const resent = (await auditEvents(harness.migrator)).filter(
      (event) => event.entity_id === id && event.action === 'TRANSFER_OTP_RESENT',
    );
    expect(resent).toEqual([
      expect.objectContaining({
        actor_user_id: ana.userId,
        metadata: {
          channel: 'EMAIL',
          expiresAt: '2026-10-13T18:07:00.000Z',
          resendsRemaining: 2,
        },
      }),
    ]);
  });

  it('TRF-19 el reenvío mueve la vigencia: a los 6 minutos de creada, el código nuevo todavía sirve', async () => {
    const { id } = await pending();
    t.clock.advance(4 * 60_000);
    await resendTransferOtp(t, ana, id);
    const code = t.mailer.lastCode(ana.person.email);
    t.clock.advance(2 * 60_000);
    const res = await confirmTransfer(t, ana, id, { otp: code });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
  });

  it('TRF-20 el cuarto reenvío responde 422 RESEND_LIMIT_REACHED sin cambiar el código', async () => {
    const { id } = await pending();
    for (let i = 0; i < 3; i++) expect((await resendTransferOtp(t, ana, id)).status).toBe(202);
    const before = await state(id);
    const fourth = await resendTransferOtp(t, ana, id);
    expect(fourth.status).toBe(422);
    expect(fourth.body.code).toBe('RESEND_LIMIT_REACHED');
    expect(await state(id)).toEqual(before);
  });

  it('TRF-20 con el correo caído responde 202 con deliveryStatus FAILED', async () => {
    const { id } = await pending();
    t.mailer.down = true;
    const res = await resendTransferOtp(t, ana, id);
    expect(res.status).toBe(202);
    expect(res.body.deliveryStatus).toBe('FAILED');
  });
});

describe('TRF-20 reenvío que no procede', () => {
  it('TRF-20 una transferencia COMPLETED responde 409 TRANSFER_NOT_PENDING con transferStatus', async () => {
    const { id, code } = await pending();
    await confirmTransfer(t, ana, id, { otp: code });
    const res = await resendTransferOtp(t, ana, id);
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'TRANSFER_NOT_PENDING', transferStatus: 'COMPLETED' });
  });

  it('TRF-20 una transferencia vencida responde 409 TRANSFER_EXPIRED', async () => {
    const { id } = await pending();
    t.clock.advance(6 * 60_000);
    const res = await resendTransferOtp(t, ana, id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TRANSFER_EXPIRED');
    expect((await state(id)).resend_count).toBe(0);
  });

  it('TRF-06 Luis no puede reenviar el código de la transferencia de Ana: 404', async () => {
    const { id } = await pending();
    const res = await resendTransferOtp(t, luis, id);
    expect(res.status).toBe(404);
    expect(t.mailer.to(luis.person.email).map((message) => message.subject)).not.toContain(
      'Tu código para confirmar una transferencia',
    );
  });
});

describe('TRF-20 escenarios de reenvío', () => {
  it('TRF-20 después de un reenvío, el código anterior responde 422 OTP_INVALID y el nuevo confirma', async () => {
    const { id, code: oldCode } = await pending();
    await resendTransferOtp(t, ana, id);
    const newCode = t.mailer.lastCode(ana.person.email);
    expect(newCode).not.toBe(oldCode);
    const withOld = await confirmTransfer(t, ana, id, { otp: oldCode });
    expect(withOld.status).toBe(422);
    expect(withOld.body).toMatchObject({ code: 'OTP_INVALID', attemptsRemaining: 2 });
    const withNew = await confirmTransfer(t, ana, id, { otp: newCode });
    expect(withNew.status).toBe(200);
    expect(withNew.body.status).toBe('COMPLETED');
  });

  it('TRF-20 tres reenvíos dejan 2, 1 y 0 restantes; el cuarto responde 422 RESEND_LIMIT_REACHED y el último código sigue sirviendo', async () => {
    const { id } = await pending();
    const remaining: number[] = [];
    for (let i = 0; i < 3; i++) {
      remaining.push((await resendTransferOtp(t, ana, id)).body.resendsRemaining);
    }
    expect(remaining).toEqual([2, 1, 0]);
    const lastCode = t.mailer.lastCode(ana.person.email);
    const fourth = await resendTransferOtp(t, ana, id);
    expect(fourth.status).toBe(422);
    expect(fourth.body.code).toBe('RESEND_LIMIT_REACHED');
    expect(t.mailer.lastCode(ana.person.email)).toBe(lastCode);
    expect((await confirmTransfer(t, ana, id, { otp: lastCode })).status).toBe(200);
  });
});
