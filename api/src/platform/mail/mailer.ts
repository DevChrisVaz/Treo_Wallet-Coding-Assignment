/** Correo transaccional ya compuesto (texto y HTML). */
export interface MailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/** Puerto de correo (PLT-16): SMTP en local (Mailpit) y en AWS (SES por su interfaz SMTP). */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export type DeliveryStatus = 'SENT' | 'FAILED';
