import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { MailMessage } from '../../../src/platform/mail/mailer.js';
import { auditEvents } from '../../helpers/audit.js';
import { buildTestApp, testConfig, type TestApp } from '../../helpers/app.js';
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

async function setup() {
  t = await buildTestApp(harness);
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
  await fund(t, ana.principal.id, '20000.00');
}

const toLuis = (amount: string) => ({
  fromAccountId: ana.principal.id,
  destination: { type: 'BENEFICIARY', beneficiaryId },
  amount,
  concept: 'Enganche',
  reference: '42',
});

function codeHash(transferId: string, code: string): string {
  return createHmac('sha256', testConfig().otpHmacSecret)
    .update(`TRANSFER_CONFIRMATION:${transferId}:${code}`)
    .digest('hex');
}

describe('TRF-15 correo del OTP', () => {
  beforeEach(async () => {
    await setup();
  });

  it('TRF-15 el correo lleva el código emitido, "$15,000.00", "Luis" y los últimos 4 dígitos de la CLABE', async () => {
    const res = await postTransfer(t, ana, toLuis('15000.00'));
    expect(res.status).toBe(201);
    expect(res.body.otp.deliveryStatus).toBe('SENT');
    const messages = t.mailer.to(ana.person.email);
    const message = messages.at(-1);
    if (!message) throw new Error('No llegó el correo del OTP');
    const code = t.mailer.lastCode(ana.person.email);
    const [stored] = await harness.migrator.query(
      `SELECT code_hash FROM app.one_time_codes WHERE subject_id = $1`,
      [res.body.id],
    );
    expect(stored.code_hash).toBe(codeHash(res.body.id, code));
    for (const body of [message.text, message.html]) {
      expect(body).toContain(code);
      expect(body).toContain('$15,000.00');
      expect(body).toContain('Luis');
      expect(body).toContain(luis.principal.clabe.slice(-4));
      expect(body).not.toContain(luis.principal.clabe);
    }
  });

  it('TRF-15 ni la respuesta, ni los logs, ni la auditoría contienen el código', async () => {
    const res = await postTransfer(t, ana, toLuis('15000.00'));
    const code = t.mailer.lastCode(ana.person.email);
    expect(JSON.stringify(res.body)).not.toContain(code);
    expect(JSON.stringify(res.headers)).not.toContain(code);
    expect(t.logs.text()).not.toContain(code);
    expect(JSON.stringify(await auditEvents(harness.migrator))).not.toContain(code);
  });

  it('TRF-15 con el servidor de correo caído responde 201 PENDING_OTP con deliveryStatus FAILED', async () => {
    t.mailer.down = true;
    const res = await postTransfer(t, ana, toLuis('15000.00'));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'PENDING_OTP',
      otp: { deliveryStatus: 'FAILED', attemptsRemaining: 3 },
    });
    const [row] = await harness.migrator.query('SELECT status FROM app.transfers WHERE id = $1', [
      res.body.id,
    ]);
    expect(row.status).toBe('PENDING_OTP');
    const failure = t.logs.entries().find((entry) => entry.msg === 'mail delivery failed');
    expect(failure).toMatchObject({ template: 'transfer-otp' });
  });
});

describe('TRF-15 el correo sale después del COMMIT', () => {
  it('TRF-15 cuando se envía el correo la transferencia ya es visible para otra conexión', async () => {
    await setup();
    const visible: string[][] = [];
    const send = t.mailer.send.bind(t.mailer);
    t.mailer.send = async (message: MailMessage) => {
      const rows: { id: string }[] = await harness.migrator.query(
        `SELECT id FROM app.transfers WHERE status = 'PENDING_OTP'`,
      );
      visible.push(rows.map((row) => row.id));
      return send(message);
    };
    const res = await postTransfer(t, ana, toLuis('15000.00'));
    expect(res.status).toBe(201);
    expect(visible).toEqual([[res.body.id]]);
  });
});
