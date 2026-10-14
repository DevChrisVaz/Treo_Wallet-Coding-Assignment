import { createTransport, type Transporter } from 'nodemailer';
import type { MailMessage, Mailer } from './mailer.js';

export interface SmtpOptions {
  readonly host: string;
  readonly port: number;
  readonly from: string;
  readonly user?: string | undefined;
  readonly password?: string | undefined;
}

/**
 * Adaptador SMTP con nodemailer: Mailpit en local (sin TLS ni autenticación) y Amazon SES por su
 * interfaz SMTP en AWS (STARTTLS y credenciales SMTP), sin cambiar código. Los tiempos de espera
 * son cortos: el envío ocurre después del COMMIT, pero la respuesta HTTP lo espera.
 */
export class SmtpMailer implements Mailer {
  private readonly transporter: Transporter;

  constructor(private readonly options: SmtpOptions) {
    this.transporter = createTransport({
      host: options.host,
      port: options.port,
      secure: options.port === 465,
      ...(options.user && options.password
        ? { auth: { user: options.user, pass: options.password }, requireTLS: true }
        : {}),
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.options.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  close(): void {
    this.transporter.close();
  }
}
