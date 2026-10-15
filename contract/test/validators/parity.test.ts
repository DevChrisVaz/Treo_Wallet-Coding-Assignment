import { Ajv2020 } from 'ajv/dist/2020';
import { describe, expect, it } from 'vitest';
import {
  amountInput,
  birthDate,
  birthState,
  clabe,
  concept,
  curp,
  otpCode,
  phone,
  reference,
  namePart,
  optionalNamePart,
  newPassword,
  rfc,
  scheduledInstant,
  toFieldErrors,
  transferForm,
} from '../../src/index';
import { contract } from '../support/contract';
import { amountVectors } from '../vectors/amount';
import {
  conceptVectors,
  namePartVectors,
  optionalNamePartVectors,
  otpVectors,
  phoneVectors,
  passwordVectors,
  referenceVectors,
  scheduledInstantVectors,
} from '../vectors/fields';
import {
  birthDateVectors,
  birthStateVectors,
  clabeVectors,
  curpVectors,
  rfcVectors,
} from '../vectors/identity';
import { transferBodyVectors } from '../vectors/transfer-body';
import { contractExpectation, type Vector } from '../vectors/types';

// JSON Schema 2020-12 es el dialecto de OpenAPI 3.1. `strict` se relaja solo para las palabras
// clave propias de OpenAPI que Ajv no conoce.
const ajv = new Ajv2020({ strict: false });

const parity: [string, { safeParse: (input: unknown) => { success: boolean } }, Vector[]][] = [
  ['AmountInput', amountInput, amountVectors],
  ['Clabe', clabe, clabeVectors],
  ['Curp', curp, curpVectors],
  ['Rfc', rfc, rfcVectors],
  ['PhoneInput', phone, phoneVectors],
  ['Concept', concept, conceptVectors],
  ['Reference', reference, referenceVectors],
  ['SixDigitCode', otpCode, otpVectors],
  ['ScheduledInstant', scheduledInstant, scheduledInstantVectors],
  ['Password', newPassword, passwordVectors],
  ['NamePart', namePart, namePartVectors],
  ['OptionalNamePart', optionalNamePart, optionalNamePartVectors],
  ['BirthDate', birthDate, birthDateVectors],
  ['BirthState', birthState, birthStateVectors],
];

describe.each(parity)('paridad con el esquema %s del contrato', (schemaName, schema, vectors) => {
  const validateContract = ajv.compile({
    ...(contract.components.schemas[schemaName] ?? {}),
    // Los schemas que usan `$ref` a otros del contrato lo resuelven contra este documento.
    components: contract.components,
  });

  it.each(vectors)('CTR-13 contrato y paquete coinciden en $input', (vector) => {
    expect(validateContract(vector.input)).toBe(contractExpectation(vector));
    expect(schema.safeParse(vector.input).success).toBe(vector.valid);
  });
});

describe('paridad del cuerpo de CreateTransferRequest', () => {
  const validateBody = ajv.compile({
    ...(contract.components.schemas.CreateTransferRequest ?? {}),
    components: contract.components,
  });

  it.each(transferBodyVectors)('CTR-13 transferForm da el resultado esperado: $name', (vector) => {
    const result = transferForm.safeParse(vector.body);
    const errors = result.success
      ? []
      : toFieldErrors(result.error).map((error) => `${error.pointer} ${error.code}`);

    expect([...errors].sort()).toEqual([...vector.errors].sort());
  });

  it.each(transferBodyVectors.filter((vector) => !vector.beyondJsonSchema))(
    'CTR-13 openapi.yaml y transferForm coinciden en: $name',
    (vector) => {
      expect(validateBody(vector.body)).toBe(vector.errors.length === 0);
    },
  );
});
