import { beforeEach, describe, expect, it } from 'vitest';
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
let beneficiaryId: string;
let anaEmail: string;
let luisEmail: string;

const SUBJECT = 'Transferencia realizada';

beforeEach(async () => {
  t = await buildTestApp(harness, { now: '2026-10-13T18:00:00.000Z' });
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  anaEmail = ana.person.email.trim().toLowerCase();
  luisEmail = luis.person.email.trim().toLowerCase();
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
  await fund(t, ana.principal.id, '20000.00');
  t.mailer.clear();
});

const body = (amount = '250.00', extra: Record<string, unknown> = {}) => ({
  fromAccountId: ana.principal.id,
  destination: { type: 'BENEFICIARY', beneficiaryId },
  amount,
  concept: 'Renta de octubre',
  reference: '42',
  ...extra,
});

async function send(payload: Record<string, unknown>, key?: string) {
  const res = await postTransfer(t, ana, payload, key);
  await t.container.notices.drain(2_000);
  return res;
}

const receipts = (to = anaEmail) => t.mailer.to(to).filter((m) => m.subject === SUBJECT);

describe('TRF-38 comprobante al crear una transferencia', () => {
  it('TRF-38 una transferencia inmediata a un beneficiario envía un solo comprobante con su detalle', async () => {
    const res = await send(body());
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('COMPLETED');
    const [mail, ...rest] = receipts();
    expect(rest).toHaveLength(0);
    expect(mail?.text).toContain('$250.00');
    // Como en el correo del código, el destino se nombra con el alias del beneficiario.
    expect(mail?.text).toContain('Destino: Luis (');
    expect(mail?.text).toContain(`terminación ${luis.principal.clabe.slice(-4)}`);
    expect(mail?.text).toContain('Renta de octubre');
    expect(mail?.text).toContain('Referencia: 42');
    expect(mail?.text).toContain('13 de octubre de 2026, 12:00');
    expect(mail?.text).toContain(res.body.id);
    expect(mail?.text).toMatch(/responde este correo/);
    for (const part of [mail?.text, mail?.html, mail?.subject]) {
      expect(part).not.toContain(luis.principal.clabe);
    }
  });

  it('TRF-38 sin referencia el comprobante no menciona una referencia', async () => {
    const { reference: _omitted, ...withoutReference } = body('100.00');
    const res = await send(withoutReference);
    expect(res.status).toBe(201);
    expect(receipts()[0]?.text).not.toContain('Referencia');
  });

  it('TRF-38 el comprobante da el monto en es-MX con separador de miles', async () => {
    const res = await send(body('9999.50'));
    expect(res.status).toBe(201);
    expect(receipts()[0]?.text).toContain('$9,999.50');
  });

  it('TRF-38 el concepto se escapa en el HTML', async () => {
    await send(body('10.00', { concept: '<i>hola</i> & chao' }));
    const mail = receipts()[0];
    expect(mail?.html).not.toContain('<i>hola</i>');
    expect(mail?.html).toContain('&lt;i&gt;hola&lt;/i&gt; &amp; chao');
  });

  it('TRF-38 el destinatario no recibe ningún correo', async () => {
    await send(body());
    expect(t.mailer.to(luisEmail)).toHaveLength(0);
  });

  it('TRF-38 repetir la llave devuelve la original y no envía otro comprobante', async () => {
    const key = crypto.randomUUID();
    await send(body(), key);
    const again = await send(body(), key);
    expect(again.status).toBe(200);
    expect(again.headers['idempotent-replayed']).toBe('true');
    expect(receipts()).toHaveLength(1);
  });

  it('TRF-38 un traspaso entre cuentas propias no envía comprobante', async () => {
    const res = await send({
      fromAccountId: ana.principal.id,
      destination: { type: 'OWN_ACCOUNT', accountId: ana.ahorro.id },
      amount: '100.00',
      concept: 'Ahorro',
      reference: '1',
    });
    expect(res.status).toBe(201);
    expect(receipts()).toHaveLength(0);
  });

  it('TRF-38 un rechazo por saldo insuficiente no envía comprobante', async () => {
    const res = await send(body('30000.00'));
    expect(res.status).toBe(422);
    expect(receipts()).toHaveLength(0);
  });

  it('TRF-38 una transferencia que espera el código solo envía el correo del código', async () => {
    const res = await send(body('15000.00'));
    expect(res.body.status).toBe('PENDING_OTP');
    expect(receipts()).toHaveLength(0);
    expect(t.mailer.to(anaEmail)).toHaveLength(1);
  });

  it('TRF-38 una programada recién creada no envía comprobante', async () => {
    const res = await send(body('100.00', { scheduledFor: '2026-10-14T06:00:00.000Z' }));
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('SCHEDULED');
    expect(receipts()).toHaveLength(0);
  });

  it('PLT-16 con el servidor de correo caído la transferencia responde 201 COMPLETED igual', async () => {
    t.mailer.down = true;
    const res = await send(body());
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('COMPLETED');
    expect(t.logs.entries().some((e) => e.template === 'transfer-receipt')).toBe(true);
  });
});
