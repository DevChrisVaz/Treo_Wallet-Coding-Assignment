import * as z from 'zod';
import { amountInput } from './amount';
import { clabe } from './clabe';
import { curp } from './curp';
import { addFieldIssue, textField } from './field-errors';
import { concept, otpCode, phone, reference } from './fields';
import { rfc } from './rfc';

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

const newPassword = textField('La contraseña es obligatoria', (value, ctx) => {
  const length = codePointLength(value);
  if (length < 12) return addFieldIssue(ctx, 'TOO_SHORT', 'Usa al menos 12 caracteres');
  if (length > 128) addFieldIssue(ctx, 'TOO_LONG', 'Usa máximo 128 caracteres');
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
  if (!uuidFormat.safeParse(value).success) {
    addFieldIssue(ctx, 'INVALID_FORMAT', 'El identificador no es válido');
  }
});

/** Formulario de registro (`RegisterRequest`). */
export const registerForm = z.strictObject({
  email,
  password: newPassword,
  fullName,
  curp,
  rfc,
  phone,
});

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

/** Formulario de transferencia (`CreateTransferRequest`). */
export const transferForm = z.strictObject({
  fromAccountId: uuid,
  destination: transferDestination,
  amount: amountInput,
  concept,
  reference,
});
