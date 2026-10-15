import { escapeHtml, layout } from '../../../platform/mail/html.js';

export interface EmailContent {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/** Código de verificación de correo (IDN-05). */
export function verificationCodeEmail(input: {
  readonly fullName: string;
  readonly code: string;
  readonly minutes: number;
}): EmailContent {
  const subject = 'Tu código para verificar tu correo';
  return {
    subject,
    text: [
      `Hola, ${input.fullName}:`,
      '',
      `Tu código de verificación es ${input.code}.`,
      `Vence en ${input.minutes} minutos. Si no fuiste tú, ignora este correo.`,
    ].join('\n'),
    html: layout(
      subject,
      `<p>Hola, ${escapeHtml(input.fullName)}:</p>` +
        `<p>Tu código de verificación es <strong style="font-size: 20px;">${escapeHtml(input.code)}</strong>.</p>` +
        `<p>Vence en ${input.minutes} minutos. Si no fuiste tú, ignora este correo.</p>`,
    ),
  };
}

/** Aviso al dueño de un email ya verificado: alguien intentó registrarse con él (IDN-01). */
export function registrationAttemptEmail(): EmailContent {
  const subject = 'Alguien intentó registrarse con tu correo';
  const lines = [
    'Recibimos una solicitud de registro con este correo, que ya tiene una cuenta verificada.',
    'No se creó ni modificó nada. Si fuiste tú, inicia sesión con tu contraseña.',
    'Si no fuiste tú, puedes ignorar este mensaje.',
  ];
  return {
    subject,
    text: lines.join('\n'),
    html: layout(subject, lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')),
  };
}
