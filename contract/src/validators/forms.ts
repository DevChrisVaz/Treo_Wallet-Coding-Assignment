import * as z from 'zod';
import { amountInput } from './amount';
import { clabe } from './clabe';
import { curp, curpBirthDate, hasReachedAge } from './curp';
import { mexicoCityDate, scheduledInstant, scheduledInstantWithin } from './dates';
import { addFieldIssue, textField } from './field-errors';
import { concept, optionalReference, otpCode, phone } from './fields';
import { rfc, rfcMatchesCurp } from './rfc';

function codePointLength(value: string): number {
  return [...value].length;
}

const NO_EDGE_SPACES = /^\S(.*\S)?$/u;
const emailFormat = z.email();
const uuidFormat = z.uuid();

const email = textField('El correo es obligatorio', (value, ctx) => {
  if (value.length > 254 || !emailFormat.safeParse(value).success) {
    addFieldIssue(ctx, 'INVALID_FORMAT', 'El correo no tiene un formato válido');
  }
});

/** Correo del registro: se recorta y se pasa a minúsculas antes de validarlo (CTR-13). */
const normalizedEmail = z
  .unknown()
  .transform((value) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  .pipe(email);

/** Contraseña nueva (`Password`): de 12 a 128 caracteres con al menos una letra y un dígito. */
export const newPassword = textField('La contraseña es obligatoria', (value, ctx) => {
  const length = codePointLength(value);
  if (length < 12) return addFieldIssue(ctx, 'TOO_SHORT', 'Usa al menos 12 caracteres');
  if (length > 128) return addFieldIssue(ctx, 'TOO_LONG', 'Usa máximo 128 caracteres');
  if (!/\p{L}/u.test(value) || !/[0-9]/.test(value)) {
    addFieldIssue(ctx, 'INVALID_FORMAT', 'Incluye al menos una letra y un número');
  }
});

const loginPassword = textField('La contraseña es obligatoria', (value, ctx) => {
  if (codePointLength(value) > 128) addFieldIssue(ctx, 'TOO_LONG', 'Usa máximo 128 caracteres');
});

const fullName = textField('El nombre es obligatorio', (value, ctx) => {
  if (value.trim() === '') return addFieldIssue(ctx, 'REQUIRED', 'El nombre es obligatorio');
  if (codePointLength(value) > 100) addFieldIssue(ctx, 'TOO_LONG', 'Máximo 100 caracteres');
});

const PERSON_NAME = /^\p{L}[\p{L}\p{M}'.-]*( \p{L}[\p{L}\p{M}'.-]*)+$/u;

/** Nombre del titular al registrarse (`PersonName`): dos palabras o más, solo letras y `' . -`. */
export const personName = textField('El nombre es obligatorio', (value, ctx) => {
  if (value.trim() === '') return addFieldIssue(ctx, 'REQUIRED', 'El nombre es obligatorio');
  const length = codePointLength(value);
  if (length < 2) return addFieldIssue(ctx, 'TOO_SHORT', 'Escribe al menos 2 caracteres');
  if (length > 100) return addFieldIssue(ctx, 'TOO_LONG', 'Máximo 100 caracteres');
  if (/[^\p{L}\p{M}'. -]/u.test(value)) {
    return addFieldIssue(
      ctx,
      'INVALID_FORMAT',
      'Solo letras, espacios, apóstrofo, guion y punto; sin números ni símbolos',
    );
  }
  if (/^ | $| {2}/.test(value)) {
    return addFieldIssue(
      ctx,
      'INVALID_FORMAT',
      'Sin espacios al inicio, al final ni repetidos entre palabras',
    );
  }
  if (!PERSON_NAME.test(value)) {
    addFieldIssue(ctx, 'INVALID_FORMAT', 'Escribe tu nombre y al menos un apellido');
  }
});

const alias = textField('El alias es obligatorio', (value, ctx) => {
  if (value.trim() === '') return addFieldIssue(ctx, 'REQUIRED', 'El alias es obligatorio');
  if (codePointLength(value) > 30) return addFieldIssue(ctx, 'TOO_LONG', 'Máximo 30 caracteres');
  if (!NO_EDGE_SPACES.test(value)) {
    addFieldIssue(ctx, 'INVALID_FORMAT', 'El alias no puede empezar ni terminar con espacios');
  }
});

const uuid = textField('El identificador es obligatorio', (value, ctx) => {
  if (!uuidFormat.safeParse(value).success) {
    addFieldIssue(ctx, 'INVALID_FORMAT', 'El identificador no es válido');
  }
});

const registerShape = {
  email: normalizedEmail,
  password: newPassword,
  fullName: personName,
  curp,
  rfc,
  phone,
};

/** Mayoría de edad para registrarse (CTR-13). */
export const MINIMUM_AGE = 18;

function registerFormWith(today: () => string) {
  return z.strictObject(registerShape).superRefine((form, ctx) => {
    // Las reglas entre campos solo aplican cuando cada campo, por separado, ya es válido.
    const curpValue = curp.safeParse(form.curp).success ? form.curp : undefined;
    if (curpValue !== undefined) {
      const birthDate = curpBirthDate(curpValue);
      if (birthDate !== null) {
        const now = today();
        if (birthDate > now) {
          ctx.addIssue({
            code: 'custom',
            path: ['curp'],
            message: 'La fecha de nacimiento de la CURP está en el futuro',
            params: { fieldCode: 'INVALID_DATE' },
          });
        } else if (!hasReachedAge(birthDate, now, MINIMUM_AGE)) {
          ctx.addIssue({
            code: 'custom',
            path: ['curp'],
            message: 'Debes tener al menos 18 años para registrarte',
            params: { fieldCode: 'DATE_OUT_OF_RANGE' },
          });
        }
      }
    }
    if (
      curpValue !== undefined &&
      rfc.safeParse(form.rfc).success &&
      !rfcMatchesCurp(form.rfc, curpValue)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['rfc'],
        message: 'El RFC no coincide con tu CURP',
        params: { fieldCode: 'INVALID_FORMAT' },
      });
    }
  });
}

/**
 * Formulario de registro (`RegisterRequest`). Además de cada campo, revisa que el RFC coincida con
 * la CURP (primeros 10 caracteres, error en `/rfc`) y que la CURP corresponda a una persona de 18
 * años o más hoy en la Ciudad de México (error en `/curp`). «Hoy» se lee del reloj en cada
 * validación; con un instante fijo, usa `registerFormAt`.
 */
export const registerForm = registerFormWith(() => mexicoCityDate(new Date()));

/** `registerForm` con «hoy» tomado del instante dado, para pruebas y para fijar el día del formulario. */
export function registerFormAt(instant: Date) {
  const today = mexicoCityDate(instant);
  return registerFormWith(() => today);
}

/** Formulario de verificación de correo (`VerifyEmailRequest`). */
export const verifyEmailForm = z.strictObject({ email, code: otpCode });

/** Formulario de inicio de sesión (`LoginRequest`). */
export const loginForm = z.strictObject({ email, password: loginPassword });

/** Formulario de alta de beneficiario (`CreateBeneficiaryRequest`). */
export const beneficiaryForm = z.strictObject({ name: fullName, alias, clabe });

/** Destino de la transferencia (`TransferDestination`): cuenta propia o beneficiario. */
export const transferDestination = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('OWN_ACCOUNT'), accountId: uuid }),
  z.strictObject({ type: z.literal('BENEFICIARY'), beneficiaryId: uuid }),
]);

/**
 * Formulario de transferencia (`CreateTransferRequest`). La referencia es opcional (cadena vacía =
 * omitida). Valida el instante programado igual que el contrato (RFC 3339 con desfase y minutos
 * exactos); el rango depende de la hora, así que lo agrega `transferFormAt`.
 */
export const transferForm = z.strictObject({
  fromAccountId: uuid,
  destination: transferDestination,
  amount: amountInput,
  concept,
  reference: optionalReference,
  scheduledFor: scheduledInstant.optional(),
});

/**
 * `transferForm` con el instante programado limitado a la ventana de `instant`: de 10 minutos a 90
 * días después (TRF-27, `DATE_OUT_OF_RANGE`).
 */
export function transferFormAt(instant: Date) {
  return transferForm.extend({
    scheduledFor: scheduledInstantWithin(instant).optional(),
  });
}
