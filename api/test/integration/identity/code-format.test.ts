import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import { registerPerson } from '../../helpers/identity.js';

const harness = useIntegrationHarness();
let t: TestApp;

beforeEach(async () => {
  t = await buildTestApp(harness);
});

describe('IDN-06 código de verificación de correo: 6 dígitos exactos', () => {
  it.each([
    ['con letras', 'abc123'],
    ['solo letras', 'abcdef'],
    ['de 5 dígitos', '12345'],
    ['de 7 dígitos', '1234567'],
    ['con símbolos', '12-456'],
  ])(
    'IDN-06 un código %s responde 422 VALIDATION_FAILED en /code y no consume intentos',
    async (_c, code) => {
      const { person } = await registerPerson(t);
      const res = await request(t.app)
        .post('/auth/verify-email')
        .send({ email: person.email, code });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.errors).toEqual([expect.objectContaining({ pointer: '/code' })]);
      const [row] = await harness.migrator.query(
        `SELECT attempts FROM app.one_time_codes WHERE purpose = 'EMAIL_VERIFICATION'`,
      );
      expect(row.attempts).toBe(0);
    },
  );
});
