import * as z from 'zod';
import { addFieldIssue, textField } from '../../../../platform/http/validation.js';

/** Sin espacios al inicio ni al final; `.` no incluye saltos de línea (patrón del contrato). */
const NO_EDGE_SPACES = /^\S(.*\S)?$/u;

/**
 * `CreateBeneficiaryRequest` (BEN-02): nombre de 1 a 100 caracteres, alias de 1 a 30 sin espacios
 * en los extremos y CLABE como string de exactamente 18 dígitos. El dígito verificador no es parte
 * del formato: es una regla de negocio que responde `CLABE_INVALID` (BEN-03, BEN-06).
 */
export const createBeneficiaryRequestSchema = z.strictObject({
  name: textField({ min: 1, max: 100 }),
  alias: textField({
    min: 1,
    max: 30,
    check: (value, ctx) => {
      if (!NO_EDGE_SPACES.test(value)) {
        addFieldIssue(ctx, 'INVALID_FORMAT', 'El alias no puede empezar ni terminar con espacios');
      }
    },
  }),
  clabe: textField({
    check: (value, ctx) => {
      if (!/^[0-9]{18}$/.test(value)) {
        addFieldIssue(ctx, 'INVALID_FORMAT', 'La CLABE debe tener exactamente 18 dígitos');
      }
    },
  }),
});

export type CreateBeneficiaryInput = z.output<typeof createBeneficiaryRequestSchema>;
