import { describe, expect, it } from 'vitest';
import { NoticeDispatcher } from '../../../src/platform/mail/notice-dispatcher.js';
import type { MailMessage, Mailer } from '../../../src/platform/mail/mailer.js';
import { captureLogger } from '../../helpers/logs.js';

const message: MailMessage = {
  to: 'ana.gomez@example.com',
  subject: 'Aviso',
  text: 'texto',
  html: '<p>texto</p>',
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

describe('PLT-16 avisos sin esperar el envío', () => {
  it('PLT-16 send no espera al servidor de correo y drain espera a que termine', async () => {
    const gate = deferred();
    const sent: MailMessage[] = [];
    const mailer: Mailer = {
      send: async (m) => {
        await gate.promise;
        sent.push(m);
      },
    };
    const dispatcher = new NoticeDispatcher(mailer, captureLogger().logger);

    dispatcher.send(message, 'login-notice');
    expect(sent).toHaveLength(0);
    expect(dispatcher.pending).toBe(1);

    gate.resolve();
    await dispatcher.drain(1_000);
    expect(sent).toEqual([message]);
    expect(dispatcher.pending).toBe(0);
  });

  it('PLT-16 un Mailer que rechaza se registra con el destinatario enmascarado y no produce unhandledRejection', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);
    try {
      const logs = captureLogger();
      const mailer: Mailer = {
        send: async () => {
          throw Object.assign(new Error('connect ECONNREFUSED ana.gomez@example.com'), {
            code: 'ESOCKET',
          });
        },
      };
      const dispatcher = new NoticeDispatcher(mailer, logs.logger);

      expect(() => dispatcher.send(message, 'login-notice')).not.toThrow();
      await dispatcher.drain(1_000);
      await new Promise((resolve) => setImmediate(resolve));

      expect(unhandled).toEqual([]);
      const failure = logs.entries().find((entry) => entry.msg === 'mail delivery failed');
      expect(failure).toMatchObject({ template: 'login-notice', to: 'an***@example.com' });
      expect(logs.text()).not.toContain('ana.gomez@example.com');
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('PLT-16 un Mailer que lanza de forma síncrona tampoco se propaga', async () => {
    const mailer = {
      send: () => {
        throw new Error('boom');
      },
    } as unknown as Mailer;
    const dispatcher = new NoticeDispatcher(mailer, captureLogger().logger);
    expect(() => dispatcher.send(message, 'login-notice')).not.toThrow();
    await dispatcher.drain(1_000);
    expect(dispatcher.pending).toBe(0);
  });

  it('PLT-16 drain deja de esperar al cumplirse el tope y avisa cuántos envíos quedaron', async () => {
    const never = new Promise<void>(() => undefined);
    const logs = captureLogger();
    const dispatcher = new NoticeDispatcher({ send: () => never }, logs.logger);
    dispatcher.send(message, 'login-notice');
    dispatcher.send(message, 'login-notice');

    const started = Date.now();
    const left = await dispatcher.drain(30);

    expect(left).toBe(2);
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(logs.entries().some((entry) => entry.pending === 2)).toBe(true);
  });

  it('PLT-16 drain sin envíos pendientes termina enseguida', async () => {
    const dispatcher = new NoticeDispatcher(
      { send: async () => undefined },
      captureLogger().logger,
    );
    expect(await dispatcher.drain(5_000)).toBe(0);
  });
});
