/**
 * Mensaje para la persona usuaria por cada `ProblemCode` del contrato, en español de México y con
 * el tono de Treo: de "tú", directo, qué pasó y qué hacer. Los clientes agregan los datos
 * variables (intentos restantes, monto restante del límite).
 */
export const problemMessages = {
  MALFORMED_REQUEST: 'No pudimos procesar la solicitud. Intenta de nuevo.',
  IDEMPOTENCY_KEY_MISSING: 'No pudimos enviar la operación. Intenta de nuevo.',
  IDEMPOTENCY_KEY_INVALID: 'No pudimos enviar la operación. Intenta de nuevo.',
  INVALID_CURSOR: 'La lista cambió. Vuelve a cargar los movimientos.',
  UNAUTHENTICATED: 'Tu sesión terminó. Inicia sesión de nuevo.',
  INVALID_CREDENTIALS: 'El correo o la contraseña no coinciden.',
  SESSION_REVOKED: 'Cerramos tu sesión por seguridad. Inicia sesión de nuevo.',
  EMAIL_NOT_VERIFIED: 'Confirma tu correo con el código que te enviamos.',
  NOT_FOUND: 'No encontramos lo que buscas.',
  BENEFICIARY_CONFLICT: 'Ya tienes un beneficiario con esa CLABE o con ese alias.',
  TRANSFER_NOT_PENDING: 'Esta transferencia ya no está pendiente.',
  TRANSFER_EXPIRED: 'El código venció. Crea la transferencia de nuevo.',
  VALIDATION_FAILED: 'Revisa los campos marcados.',
  INSUFFICIENT_FUNDS: 'No tienes saldo suficiente para esta transferencia.',
  DAILY_LIMIT_EXCEEDED: 'Esta transferencia supera lo que te queda del límite de hoy.',
  SAME_ACCOUNT_TRANSFER: 'Elige una cuenta de destino distinta a la de origen.',
  IDEMPOTENCY_KEY_REUSED:
    'Esta operación ya se envió con otros datos. Empieza una transferencia nueva.',
  CLABE_INVALID: 'Revisa la CLABE: el dígito verificador no coincide.',
  CLABE_NOT_IN_PLATFORM: 'Esa CLABE no pertenece a una cuenta de TreoWallet.',
  BENEFICIARY_IS_OWN_ACCOUNT:
    'Esa CLABE es tuya. Para mover dinero entre tus cuentas, elige "Mis cuentas".',
  OTP_INVALID: 'El código no es correcto.',
  OTP_ATTEMPTS_EXHAUSTED: 'Agotaste los intentos. Cancelamos la transferencia.',
  RESEND_LIMIT_REACHED: 'Ya reenviamos el código el máximo de veces.',
  VERIFICATION_CODE_INVALID: 'El código no es correcto o ya venció.',
  RATE_LIMITED: 'Hiciste demasiados intentos. Espera un momento y vuelve a intentar.',
  INTERNAL_ERROR: 'Algo falló de nuestro lado. Intenta de nuevo en unos minutos.',
} as const satisfies Record<string, string>;

export type KnownProblemCode = keyof typeof problemMessages;

/** Mensaje para un `code` de error; un código desconocido usa el de `INTERNAL_ERROR`. */
export function problemMessage(code: string): string {
  // hasOwnProperty en lugar de Object.hasOwn: el paquete también corre en Hermes.
  return Object.prototype.hasOwnProperty.call(problemMessages, code)
    ? problemMessages[code as KnownProblemCode]
    : problemMessages.INTERNAL_ERROR;
}
