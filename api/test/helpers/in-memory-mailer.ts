import type { MailMessage, Mailer } from '../../src/platform/mail/mailer.js';

/**
 * Mailer en memoria para las pruebas de casos de uso: guarda lo enviado y puede simular un
 * servidor caído.
 */
export class InMemoryMailer implements Mailer {
  readonly sent: MailMessage[] = [];
  down = false;

  async send(message: MailMessage): Promise<void> {
    if (this.down) throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ESOCKET' });
    this.sent.push(message);
  }

  to(address: string): MailMessage[] {
    return this.sent.filter((message) => message.to === address);
  }

  /** Último código de 6 dígitos enviado a `address`. */
  lastCode(address: string): string {
    const message = this.to(address).at(-1);
    const code = message?.text.match(/\b([0-9]{6})\b/)?.[1];
    if (!code) throw new Error(`No hay un código enviado a ${address}`);
    return code;
  }

  clear(): void {
    this.sent.length = 0;
  }
}
