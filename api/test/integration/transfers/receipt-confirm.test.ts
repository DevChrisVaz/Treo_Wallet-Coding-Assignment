import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { wrongCode } from '../../helpers/identity.js';
import {
  addBeneficiary,
  confirmTransfer,
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
let anaEmail: string;

const SUBJECT = 'Transferencia realizada';

beforeEach(async () => {
  t = await buildTestApp(harness, { now: '2026-10-13T18:00:00.000Z' });
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  anaEmail = ana.person.email.trim().toLowerCase();
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
  await fund(t, ana.principal.id, '40000.00');
});

async function pending(extra: Record<string, unknown> = {}) {
  const res = await postTransfer(t, ana, {
    fromAccountId: ana.principal.id,
    destination: { type: 'BENEFICIARY', beneficiaryId },
    amount: '15000.00',
    concept: 'Enganche',
    reference: '42',
    ...extra,
  });
  expect(res.body.status).toBe('PENDING_OTP');
  const code = t.mailer.lastCode(anaEmail);
  t.mailer.clear();
  return { id: res.body.id as string, code };
}

async function confirm(id: string, otp: string) {
  const res = await confirmTransfer(t, ana, id, { otp });
  await t.container.notices.drain(2_000);
  return res;
}

const receipts = () => t.mailer.to(anaEmail).filter((m) => m.subject === SUBJECT);

describe('TRF-38 comprobante al confirmar con el código', () => {
  it('TRF-38 confirmar con el código correcto envía un solo comprobante con el detalle', async () => {
    const { id, code } = await pending();
    const res = await confirm(id, code);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
    const [mail, ...rest] = receipts();
    expect(rest).toHaveLength(0);
    expect(mail?.text).toContain('$15,000.00');
    expect(mail?.text).toContain('Enganche');
    expect(mail?.text).toContain(id);
    expect(mail?.text).not.toContain(code);
    expect(mail?.text).not.toContain(luis.principal.clabe);
  });

  it('TRF-38 un código incorrecto no envía comprobante', async () => {
    const { id, code } = await pending();
    const res = await confirm(id, wrongCode(code));
    expect(res.status).toBe(422);
    expect(receipts()).toHaveLength(0);
  });

  it('TRF-38 confirmar de nuevo una transferencia ya completada responde 200 sin otro comprobante', async () => {
    const { id, code } = await pending();
    await confirm(id, code);
    const again = await confirm(id, code);
    expect(again.status).toBe(200);
    expect(receipts()).toHaveLength(1);
  });

  it('TRF-38 dos confirmaciones simultáneas envían un solo comprobante', async () => {
    const { id, code } = await pending();
    const [a, b] = await Promise.all([
      confirmTransfer(t, ana, id, { otp: code }),
      confirmTransfer(t, ana, id, { otp: code }),
    ]);
    await t.container.notices.drain(2_000);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(receipts()).toHaveLength(1);
  });

  it('TRF-38 una transferencia que falla al revalidar el saldo no envía comprobante', async () => {
    const { id, code } = await pending();
    // Se gasta el saldo mientras espera el código.
    for (const reference of ['1', '2', '3']) {
      await postTransfer(t, ana, {
        fromAccountId: ana.principal.id,
        destination: { type: 'BENEFICIARY', beneficiaryId },
        amount: '9999.00',
        concept: 'Otro',
        reference,
      });
    }
    await t.container.notices.drain(2_000);
    t.mailer.clear();
    const res = await confirm(id, code);
    expect(res.status).toBe(422);
    expect(receipts()).toHaveLength(0);
  });

  it('TRF-38 confirmar una programada solo la deja programada y no envía comprobante', async () => {
    const { id, code } = await pending({ scheduledFor: '2026-10-14T06:00:00.000Z' });
    const res = await confirm(id, code);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SCHEDULED');
    expect(receipts()).toHaveLength(0);
  });

  it('PLT-16 con el servidor de correo caído la confirmación responde 200 COMPLETED igual', async () => {
    const { id, code } = await pending();
    t.mailer.down = true;
    const res = await confirm(id, code);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('COMPLETED');
  });
});
