import * as z from 'zod';
import { addFieldIssue, emailField, textField } from '../../../../platform/http/validation.js';
import { validateCurp } from '../../domain/curp.js';
import { toE164 } from '../../domain/phone.js';
import { validateRfc } from '../../domain/rfc.js';

/** CURP con estructura, fecha y dígito verificador (las reglas viven en el dominio). */
const curpField = textField({
  check: (value, ctx) => {
    switch (validateCurp(value)) {
      case 'INVALID_FORMAT':
        return addFieldIssue(ctx, 'INVALID_FORMAT', 'La CURP no tiene un formato válido');
      case 'INVALID_DATE':
        return addFieldIssue(ctx, 'INVALID_DATE', 'La fecha de nacimiento de la CURP no existe');
      case 'INVALID_CHECK_DIGIT':
        return addFieldIssue(
          ctx,
          'INVALID_CHECK_DIGIT',
          'El dígito verificador de la CURP no es válido',
        );
      case 'VALID':
        return undefined;
    }
  },
});

/** RFC de persona física con fecha real. */
const rfcField = textField({
  check: (value, ctx) => {
    switch (validateRfc(value)) {
      case 'INVALID_FORMAT':
        return addFieldIssue(ctx, 'INVALID_FORMAT', 'El RFC no tiene un formato válido');
      case 'INVALID_DATE':
        return addFieldIssue(ctx, 'INVALID_DATE', 'La fecha del RFC no existe');
      case 'VALID':
        return undefined;
    }
  },
});

/** Teléfono nacional de 10 dígitos; se entrega ya en E.164. */
const phoneField = textField({
  check: (value, ctx) => {
    if (toE164(value) === null) {
      addFieldIssue(
        ctx,
        'INVALID_FORMAT',
        'El teléfono debe tener 10 dígitos, sin lada ni espacios',
      );
    }
  },
}).transform((value) => toE164(value) as string);

const sixDigitCode = textField({
  check: (value, ctx) => {
    if (!/^[0-9]{6}$/.test(value))
      addFieldIssue(ctx, 'INVALID_FORMAT', 'El código debe tener 6 dígitos');
  },
});

const refreshToken = textField({ min: 32, max: 256 });

/** `RegisterRequest` del contrato, con email normalizado y teléfono en E.164 (IDN-02). */
export const registerRequestSchema = z.strictObject({
  email: emailField(),
  password: textField({ min: 12, max: 128 }),
  fullName: textField({ min: 1, max: 100 }),
  curp: curpField,
  rfc: rfcField,
  phone: phoneField,
});
export type RegisterInput = z.output<typeof registerRequestSchema>;

export const verifyEmailRequestSchema = z.strictObject({ email: emailField(), code: sixDigitCode });
export const resendVerificationRequestSchema = z.strictObject({ email: emailField() });
export const loginRequestSchema = z.strictObject({
  email: emailField(),
  password: textField({ min: 1, max: 128 }),
});
export const refreshRequestSchema = z.strictObject({ refreshToken });
export const logoutRequestSchema = z.strictObject({ refreshToken });
