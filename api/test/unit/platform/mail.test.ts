import { describe, expect, it } from 'vitest';
import {
  identityUseAttemptEmail,
  registrationAttemptEmail,
  verificationCodeEmail,
} from '../../../src/modules/identity/application/email-templates.js';
import { deliverAfterCommit } from '../../../src/platform/mail/deliver.js';
import {
  codeBlock,
  detailRows,
  layout,
  noticeBox,
  paragraph,
} from '../../../src/platform/mail/html.js';
import type { MailMessage, Mailer } from '../../../src/platform/mail/mailer.js';
import { captureLogger } from '../../helpers/logs.js';

const failingMailer: Mailer = {
  send: async () => {
    throw Object.assign(
      new Error('Can not deliver to <ana.gomez@example.com>: connect ECONNREFUSED'),
      {
        code: 'ESOCKET',
      },
    );
  },
};

describe('PLT-16 plantillas de correo en español', () => {
  it('PLT-16 el correo de verificación lleva el código y su vigencia', () => {
    const mail = verificationCodeEmail({ fullName: 'Ana Gómez', code: '493817', minutes: 15 });
    expect(mail.subject).toMatch(/código/i);
    expect(mail.text).toContain('493817');
    expect(mail.text).toContain('15 minutos');
    expect(mail.html).toContain('493817');
  });

  it('PLT-16 escapa el HTML de los datos del usuario', () => {
    const mail = verificationCodeEmail({ fullName: '<script>x</script>', code: '1', minutes: 15 });
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });

  it('IDN-16 el aviso al dueño de los datos no dice qué dato se usó ni trae código', () => {
    const mail = identityUseAttemptEmail();
    expect(mail.subject).toBe('Alguien intentó registrarse con tus datos');
    for (const part of [mail.subject, mail.text, mail.html]) {
      expect(part).not.toMatch(/CURP|RFC|tel[eé]fono|[0-9]{6}/i);
    }
  });

  it('IDN-01 el aviso de intento de registro no crea nada ni trae código', () => {
    const mail = registrationAttemptEmail();
    expect(mail.subject).toMatch(/registr/i);
    expect(mail.text).not.toMatch(/[0-9]{6}/);
  });
});

describe('PLT-16 envío después del COMMIT', () => {
  it('PLT-16 devuelve SENT cuando el servidor acepta el correo', async () => {
    const sent: MailMessage[] = [];
    const logs = captureLogger();
    const status = await deliverAfterCommit(
      { send: async (message) => void sent.push(message) },
      logs.logger,
      { to: 'ana@example.com', subject: 'Hola', text: 'código 123456', html: '<p>123456</p>' },
      'verification-code',
    );
    expect(status).toBe('SENT');
    expect(sent).toHaveLength(1);
  });

  it('PLT-16 una falla no lanza: se registra con el destinatario enmascarado y sin el código', async () => {
    const logs = captureLogger();
    const status = await deliverAfterCommit(
      failingMailer,
      logs.logger,
      {
        to: 'ana.gomez@example.com',
        subject: 'Tu código',
        text: 'Tu código es 493817',
        html: '<p>493817</p>',
      },
      'verification-code',
    );
    expect(status).toBe('FAILED');
    const output = logs.text();
    expect(output).toContain('mail delivery failed');
    expect(output).toContain('an***@example.com');
    expect(output).toContain('verification-code');
    expect(output).not.toContain('ana.gomez@example.com');
    expect(output).not.toContain('493817');
  });

  it('TRF-35 un aviso con contexto se registra como WARN con su id y sin el destinatario', async () => {
    const logs = captureLogger();
    const status = await deliverAfterCommit(
      failingMailer,
      logs.logger,
      { to: 'ana.gomez@example.com', subject: 'Aviso', text: 'No se realizó', html: '<p>No</p>' },
      'scheduled-transfer-failed',
      { level: 'warn', context: { transferId: '6c3501fc-d2e5-4ae9-86ce-4e386e6ffb2d' } },
    );
    expect(status).toBe('FAILED');
    const [entry] = logs.entries();
    expect(entry).toMatchObject({
      level: 'warn',
      msg: 'mail delivery failed',
      template: 'scheduled-transfer-failed',
      transferId: '6c3501fc-d2e5-4ae9-86ce-4e386e6ffb2d',
    });
    expect(entry).not.toHaveProperty('to');
    expect(logs.text()).not.toContain('ana.gomez@example.com');
  });
});

describe('PLT-16 layout de marca', () => {
  it('PLT-16 envuelve el cuerpo con la marca, el viewport y el pie de TreoWallet', () => {
    const html = layout('Asunto', '<p>cuerpo</p>', 'vista previa');
    expect(html).toContain('name="viewport"');
    expect(html).toContain('Treo<span');
    expect(html).toContain('>Wallet</span>');
    expect(html).toContain('TreoWallet · Este es un correo automático.');
    expect(html).toContain('<p>cuerpo</p>');
    expect(html).toContain('vista previa');
    expect(html).not.toContain('Billetera');
  });

  it('PLT-16 escapa el título, el preheader y los valores de los helpers', () => {
    const html = layout(
      '<b>t</b>',
      codeBlock('<i>1</i>') +
        detailRows([['<l>', '<v>']]) +
        noticeBox('danger', '<n>') +
        paragraph('<p>'),
      '<h>',
    );
    for (const raw of ['<b>t</b>', '<i>1</i>', '<l>', '<v>', '<n>', '<h>']) {
      expect(html).not.toContain(raw);
    }
    expect(html).toContain('&lt;v&gt;');
  });
});
