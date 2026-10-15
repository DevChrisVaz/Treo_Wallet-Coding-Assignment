import * as z from 'zod';
import { amountInput } from './amount';
import { clabe } from './clabe';
import { curp, curpBirthDate, curpBirthState, hasReachedAge } from './curp';
import { mexicoCityDate, scheduledInstant, scheduledInstantWithin } from './dates';
import { addFieldIssue, textField, type FieldContext } from './field-errors';
import type { FieldErrorCode, TransferDestination } from '../types';
import {
  birthDate,
  birthState,
  concept,
  namePart,
  optionalNamePart,
  optionalReference,
  otpCode,
  phone,
} from './fields';
import { rfc, rfcMatchesCurp } from './rfc';

function codePointLength(value: string): number {
  return [...value].length;
}

const NO_EDGE_SPACES = /^\S(.*\S)?$/u;
const emailFormat = z.email();
// Mismo patrón que el formato `uuid` de JSON Schema (ajv-formats): ocho-cuatro-cuatro-cuatro-doce
// dígitos hexadecimales, sin exigir versión ni variante, para aceptar lo mismo que `openapi.yaml`.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

const alias = textField('El alias es obligatorio', (value, ctx) => {
  if (value.trim() === '') return addFieldIssue(ctx, 'REQUIRED', 'El alias es obligatorio');
  if (codePointLength(value) > 30) return addFieldIssue(ctx, 'TOO_LONG', 'Máximo 30 caracteres');
  if (!NO_EDGE_SPACES.test(value)) {
    addFieldIssue(ctx, 'INVALID_FORMAT', 'El alias no puede empezar ni terminar con espacios');
  }
});

const uuid = textField('El identificador es obligatorio', (value, ctx) => {
  if (!UUID.test(value)) {
    addFieldIssue(ctx, 'INVALID_FORMAT', 'El identificador no es válido');
  }
});

const registerShape = {
  email: normalizedEmail,
  password: newPassword,
  firstNames: namePart,
  paternalSurname: namePart,
  maternalSurname: optionalNamePart,
  birthDate,
  birthState,
  curp,
  rfc,
  phone,
};

/** Mayoría de edad para registrarse (CTR-13). */
export const MINIMUM_AGE = 18;

function registerFormWith(today: () => string) {
  return z.strictObject(registerShape).superRefine((form, ctx) => {
    // Las reglas entre campos solo aplican cuando cada campo, por separado, ya es válido.
    if (
      namePart.safeParse(form.firstNames).success &&
      namePart.safeParse(form.paternalSurname).success &&
      [form.firstNames, form.paternalSurname, form.maternalSurname]
        .filter((part) => part !== undefined && part !== '')
        .join(' ').length > 100
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['firstNames'],
        message: 'El nombre completo no puede pasar de 100 caracteres',
        params: { fieldCode: 'TOO_LONG' },
      });
    }

    const curpValue = curp.safeParse(form.curp).success ? form.curp : undefined;
    const dateValue = birthDate.safeParse(form.birthDate).success ? form.birthDate : undefined;
    const stateValue = birthState.safeParse(form.birthState).success ? form.birthState : undefined;

    if (dateValue !== undefined) {
      const curpDate = curpValue === undefined ? null : curpBirthDate(curpValue);
      if (curpDate !== null && dateValue !== curpDate) {
        ctx.addIssue({
          code: 'custom',
          path: ['birthDate'],
          message: 'La fecha no coincide con tu CURP',
          params: { fieldCode: 'INVALID_FORMAT' },
        });
      } else {
        const now = today();
        if (dateValue > now) {
          ctx.addIssue({
            code: 'custom',
            path: ['birthDate'],
            message: 'La fecha de nacimiento está en el futuro',
            params: { fieldCode: 'INVALID_DATE' },
          });
        } else if (!hasReachedAge(dateValue, now, MINIMUM_AGE)) {
          ctx.addIssue({
            code: 'custom',
            path: ['birthDate'],
            message: 'Debes tener al menos 18 años para registrarte',
            params: { fieldCode: 'DATE_OUT_OF_RANGE' },
          });
        }
      }
    }
    if (
      curpValue !== undefined &&
      stateValue !== undefined &&
      curpBirthState(curpValue) !== stateValue
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['birthState'],
        message: 'La entidad no coincide con tu CURP',
        params: { fieldCode: 'INVALID_FORMAT' },
      });
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
 * la CURP (primeros 10 caracteres, error en `/rfc`) y que la fecha de nacimiento, igual a la de la CURP, sea de una persona de
 * 18 años o más hoy en la Ciudad de México (error en `/birthDate`) y que la entidad sea la de la CURP (`/birthState`). «Hoy» se lee del reloj en cada
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

function destinationIssue(
  ctx: FieldContext,
  path: string[],
  fieldCode: FieldErrorCode,
  message: string,
) {
  ctx.addIssue({ code: 'custom', message, path, params: { fieldCode } });
}

/**
 * Destino de la transferencia (`TransferDestination`) como unión discriminada por `type` (`OWN_ACCOUNT` con `accountId`, `BENEFICIARY` con
 * `beneficiaryId`), con un error determinista por campo: cada variante exige su id y rechaza el
 * de la otra (`UNKNOWN_FIELD`).
 */
export const transferDestination = z
  .unknown()
  .superRefine((value, ctx) => {
    if (value === undefined || value === null) {
      return addFieldIssue(ctx, 'REQUIRED', 'El destino es obligatorio');
    }
    if (typeof value !== 'object' || Array.isArray(value)) {
      return addFieldIssue(ctx, 'INVALID_TYPE', 'El destino debe ser un objeto');
    }
    const destination = value as Record<string, unknown>;
    const idKey =
      destination.type === 'OWN_ACCOUNT'
        ? 'accountId'
        : destination.type === 'BENEFICIARY'
          ? 'beneficiaryId'
          : undefined;
    if (!idKey) {
      return destinationIssue(
        ctx,
        ['type'],
        destination.type === undefined ? 'REQUIRED' : 'INVALID_FORMAT',
        'El tipo de destino debe ser OWN_ACCOUNT o BENEFICIARY',
      );
    }
    for (const key of Object.keys(destination)) {
      if (key !== 'type' && key !== idKey) {
        destinationIssue(ctx, [key], 'UNKNOWN_FIELD', 'Campo no permitido');
      }
    }
    const id = destination[idKey];
    if (id === undefined || id === null) {
      destinationIssue(ctx, [idKey], 'REQUIRED', 'Falta el id del destino');
    } else if (typeof id !== 'string') {
      destinationIssue(ctx, [idKey], 'INVALID_TYPE', 'Debe ser texto');
    } else if (!UUID.test(id)) {
      destinationIssue(ctx, [idKey], 'INVALID_FORMAT', 'El identificador no es válido');
    }
  })
  .transform((value) => value as TransferDestination);

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
