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
  newPassword,
  rfc,
  scheduledInstant,
} from '../../src/index';
import { contract } from '../support/contract';
import { amountVectors } from '../vectors/amount';
import {
  conceptVectors,
  namePartVectors,
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
  ['BirthDate', birthDate, birthDateVectors],
  ['BirthState', birthState, birthStateVectors],
];

describe.each(parity)('paridad con el esquema %s del contrato', (schemaName, schema, vectors) => {
  const validateContract = ajv.compile(contract.components.schemas[schemaName] ?? {});

  it.each(vectors)('CTR-13 contrato y paquete coinciden en $input', (vector) => {
    expect(validateContract(vector.input)).toBe(contractExpectation(vector));
    expect(schema.safeParse(vector.input).success).toBe(vector.valid);
  });
});
