import { createServer } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SmtpMailer } from '../../../src/platform/mail/smtp-mailer.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  confirmTransfer,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';
import { clearMailbox, messagesTo, smtpHost, smtpPort } from '../../helpers/mailpit.js';

const harness = useIntegrationHarness();
let ana: LedgerUser;
let luis: LedgerUser;
let beneficiaryId: string;
let mailer: SmtpMailer | undefined;

/** Un puerto local donde nadie escucha: el servidor SMTP caído. */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

/**
 * Los usuarios se preparan con el correo en memoria (para leer sus códigos de verificación); la
 * transferencia se hace con otra instancia de la API sobre la misma base y el SMTP real.
 */
beforeEach(async () => {
  await clearMailbox();
  const setup = await buildTestApp(harness);
  ana = await ledgerUser(setup, harness);
  luis = await ledgerUser(setup, harness);
  beneficiaryId = await addBeneficiary(setup, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
  await fund(setup, ana.principal.id, '20000.00');
});

afterEach(() => {
  mailer?.close();
  mailer = undefined;
});

async function appWithSmtp(port: number, host = smtpHost): Promise<TestApp> {
  mailer = new SmtpMailer({ host, port, from: 'Billetera <no-reply@wallet.local>' });
  return buildTestApp(harness, { overrides: { mailer } });
}

const toLuis = () => ({
  fromAccountId: ana.principal.id,
  destination: { type: 'BENEFICIARY', beneficiaryId },
  amount: '15000.00',
  concept: 'Enganche',
  reference: '42',
});

describe('TRF-15 correo del OTP en Mailpit', () => {
  it('TRF-15 el buzón recibe el código con "$15,000.00", "Luis" y los últimos 4 dígitos; la respuesta y los logs no lo contienen', async () => {
    const t = await appWithSmtp(smtpPort);
    const res = await postTransfer(t, ana, toLuis());
    expect(res.status).toBe(201);
    expect(res.body.otp.deliveryStatus).toBe('SENT');

    const inbox = await messagesTo(ana.person.email);
    const message = inbox.find((m) => m.subject === 'Tu código para confirmar una transferencia');
    if (!message) throw new Error('No llegó el correo del OTP a Mailpit');
    const code = /\b([0-9]{6})\b/.exec(message.text)?.[1];
    if (!code) throw new Error('El correo no trae un código de 6 dígitos');
    for (const body of [message.text, message.html]) {
      expect(body).toContain('$15,000.00');
      expect(body).toContain('Luis');
      expect(body).toContain(luis.principal.clabe.slice(-4));
      expect(body).not.toContain(luis.principal.clabe);
    }
    expect(JSON.stringify(res.body)).not.toContain(code);
    expect(t.logs.text()).not.toContain(code);

    // El código del correo es el que confirma la transferencia.
    const confirmed = await confirmTransfer(t, ana, res.body.id, { otp: code });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.status).toBe('COMPLETED');
  });

  it('TRF-15 con el servidor SMTP caído responde 201 PENDING_OTP con deliveryStatus FAILED', async () => {
    const t = await appWithSmtp(await closedPort(), '127.0.0.1');
    const res = await postTransfer(t, ana, toLuis());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'PENDING_OTP', otp: { deliveryStatus: 'FAILED' } });
    const failure = t.logs.entries().find((entry) => entry.msg === 'mail delivery failed');
    expect(failure).toMatchObject({ template: 'transfer-otp' });
    expect(t.logs.text()).not.toContain(ana.person.email);
    expect(await messagesTo(ana.person.email)).toEqual([]);
  });
});
