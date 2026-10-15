import { formatMexicoCityDateTime } from '@devchrisvaz/wallet-contract';
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

/**
 * Aviso al dueño de una CURP, un RFC o un teléfono cuando un registro en revisión verifica su
 * correo con esos datos (IDN-16). No dice cuál dato ni el correo de quien lo intentó.
 */
export function identityUseAttemptEmail(): EmailContent {
  const subject = 'Alguien intentó registrarse con tus datos';
  const lines = [
    'Alguien intentó abrir una cuenta en TreoWallet con datos de identidad que ya están en tu cuenta.',
    'No tuvo acceso a tu cuenta ni a tu dinero, y su registro quedó en revisión.',
    'Si fuiste tú, no tienes que hacer nada. Si no fuiste tú, responde este correo para que lo revisemos contigo.',
  ];
  return {
    subject,
    text: lines.join('\n'),
    html: layout(subject, lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')),
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

/**
 * Aviso de un inicio de sesión con contraseña (IDN-18): cuándo (hora de la Ciudad de México), desde
 * qué cliente (ya descrito en palabras) y la IP con su último octeto oculto. No lleva la contraseña,
 * los tokens ni el `User-Agent` tal como llegó. Dice qué hacer si no fue la persona.
 */
export function loginNoticeEmail(input: {
  readonly at: Date;
  readonly client: string;
  readonly maskedIp: string;
}): EmailContent {
  const subject = 'Iniciaste sesión en TreoWallet';
  const lines = [
    'Iniciaste sesión en TreoWallet.',
    `Fecha y hora: ${formatMexicoCityDateTime(input.at)} (hora de la Ciudad de México).`,
    `Desde: ${input.client}.`,
    `IP: ${input.maskedIp}.`,
    'Si fuiste tú, no tienes que hacer nada.',
    'Si no fuiste tú, responde este correo para que lo revisemos contigo.',
  ];
  return {
    subject,
    text: lines.join('\n'),
    html: layout(subject, lines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')),
  };
}
