import { createServer } from 'node:net';
import { beforeEach, describe, expect, it } from 'vitest';
import { verificationCodeEmail } from '../../../src/modules/identity/application/email-templates.js';
import { deliverAfterCommit } from '../../../src/platform/mail/deliver.js';
import { SmtpMailer } from '../../../src/platform/mail/smtp-mailer.js';
import { InMemoryMailer } from '../../helpers/in-memory-mailer.js';
import { captureLogger } from '../../helpers/logs.js';
import { clearMailbox, messagesTo, smtpHost, smtpPort } from '../../helpers/mailpit.js';

/** Un puerto local donde nadie escucha: simula el servidor SMTP caído. */
async function closedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

describe('PLT-16 entrega de correo transaccional', () => {
  beforeEach(async () => {
    await clearMailbox();
  });

  it('PLT-16 el adaptador SMTP entrega a Mailpit, que lo muestra en su bandeja', async () => {
    const mailer = new SmtpMailer({
      host: smtpHost,
      port: smtpPort,
      from: 'Billetera <no-reply@wallet.local>',
    });
    const content = verificationCodeEmail({ fullName: 'Ana Gómez', code: '493817', minutes: 15 });
    try {
      await mailer.send({ to: 'ana.smtp@example.com', ...content });
    } finally {
      mailer.close();
    }
    const messages = await messagesTo('ana.smtp@example.com');
    expect(messages).toHaveLength(1);
    expect(messages[0]?.subject).toBe(content.subject);
    expect(messages[0]?.text).toContain('493817');
    expect(messages[0]?.html).toContain('493817');
  });

  it('PLT-16 con el servidor SMTP caído el envío falla rápido, sin lanzar y sin exponer datos', async () => {
    const mailer = new SmtpMailer({
      host: '127.0.0.1',
      port: await closedPort(),
      from: 'x@wallet.local',
    });
    const logs = captureLogger();
    const started = Date.now();
    const status = await deliverAfterCommit(
      mailer,
      logs.logger,
      { to: 'ana.caido@example.com', subject: 'Código', text: 'Tu código es 112233', html: '' },
      'verification-code',
    );
    mailer.close();
    expect(status).toBe('FAILED');
    expect(Date.now() - started).toBeLessThan(6_000);
    expect(logs.text()).not.toContain('ana.caido@example.com');
    expect(logs.text()).not.toContain('112233');
  });

  it('PLT-16 el mailer en memoria registra lo enviado y simula caídas para los casos de uso', async () => {
    const mailer = new InMemoryMailer();
    await mailer.send({ to: 'a@example.com', subject: 's', text: 'Tu código es 654321', html: '' });
    expect(mailer.lastCode('a@example.com')).toBe('654321');
    mailer.down = true;
    await expect(
      mailer.send({ to: 'a@example.com', subject: 's', text: 't', html: '' }),
    ).rejects.toThrow();
    expect(mailer.to('a@example.com')).toHaveLength(1);
  });
});
