import { registerFormAt } from '@devchrisvaz/wallet-contract';
import * as z from 'zod';
import { addFieldIssue, emailField, textField } from '../../../../platform/http/validation.js';
import { toE164 } from '../../domain/phone.js';

const sixDigitCode = textField({
  check: (value, ctx) => {
    if (!/^[0-9]{6}$/.test(value))
      addFieldIssue(ctx, 'INVALID_FORMAT', 'El código debe tener 6 dígitos');
  },
});

const refreshToken = textField({ min: 32, max: 256 });

/**
 * `RegisterRequest` del contrato (IDN-01, IDN-02), con "hoy" tomado de `now` (el
 * `Clock` de la API). Es el `registerFormAt` del paquete del contrato, sin reglas duplicadas:
 * nombre de persona, email recortado y en minúsculas, contraseña con letra y dígito, teléfono de 10
 * dígitos que no empieza con 0 ni 1, CURP de una persona mayor de edad con fecha real y no futura, y
 * RFC cuyos primeros 10 caracteres son los de la CURP. Entrega el teléfono ya en E.164.
 */
export function registerRequestSchemaAt(now: Date) {
  return registerFormAt(now).transform((form) => ({
    ...form,
    phone: toE164(form.phone) as string,
  }));
}
export type RegisterInput = z.output<ReturnType<typeof registerRequestSchemaAt>>;

export const verifyEmailRequestSchema = z.strictObject({ email: emailField(), code: sixDigitCode });
export const resendVerificationRequestSchema = z.strictObject({ email: emailField() });
export const loginRequestSchema = z.strictObject({
  email: emailField(),
  password: textField({ min: 1, max: 128 }),
});
export const refreshRequestSchema = z.strictObject({ refreshToken });
export const logoutRequestSchema = z.strictObject({ refreshToken });
