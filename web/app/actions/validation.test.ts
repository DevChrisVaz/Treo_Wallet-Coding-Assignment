import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionStore } from '@/lib/server/session-store';
import { BENEFICIARY, PRINCIPAL } from '@/test/fixtures';
import { fakeApi } from '@/test/support/fake-api';
import { resetRequest } from '@/test/support/next-headers';
import { SESSION_ID, sessionData } from '@/test/support/session';
import { login, register } from './auth';
import { createBeneficiary } from './beneficiaries';
import { createTransfer } from './transfers';

vi.mock('next/headers', () => import('@/test/support/next-headers'));

/*
 * Cada Server Action es un endpoint público (WEB-07): el cuerpo se vuelve a validar en el servidor
 * con el esquema del contrato, sin confiar en el formulario del navegador. Un cuerpo inválido
 * responde `VALIDATION_FAILED` con sus campos y no llega a la API ni filtra detalles internos.
 */

const KEY = '9b2f0c1e-5a4d-4e3b-8c2a-1f0e9d8c7b6a';
const TRANSFER = {
  fromAccountId: PRINCIPAL.id,
  destination: { type: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id },
  amount: '50.00',
  concept: 'Renta',
};
const BENEFICIARY_INPUT = {
  name: BENEFICIARY.name,
  alias: BENEFICIARY.alias,
  clabe: BENEFICIARY.clabe,
};

beforeEach(async () => {
  await sessionStore().delete(SESSION_ID);
  await sessionStore().set(SESSION_ID, sessionData());
  resetRequest({
    headers: { 'x-request-id': 'bff-123', 'x-forwarded-for': '203.0.113.7' },
    cookies: { sid: SESSION_ID },
  });
});

function pointers(result: { ok: boolean; problem?: { errors?: { pointer: string }[] } }) {
  return result.problem?.errors?.map((error) => error.pointer);
}

describe('validación de cuerpos en el servidor', () => {
  it.each([null, undefined, 'texto', 42, []])(
    'WEB-07 createTransfer rechaza un cuerpo que no es un objeto (%j) sin llamar a la API',
    async (body) => {
      const api = fakeApi();
      const result = await createTransfer(body, KEY);
      expect(result).toMatchObject({
        ok: false,
        problem: { status: 422, code: 'VALIDATION_FAILED', requestId: 'bff-123' },
      });
      expect(api.calls).toHaveLength(0);
    },
  );

  it('WEB-07 createTransfer rechaza campos de más y reporta los de menos por su puntero', async () => {
    const api = fakeApi();
    const extra = await createTransfer({ ...TRANSFER, status: 'COMPLETED' }, KEY);
    expect(extra).toMatchObject({ ok: false, problem: { code: 'VALIDATION_FAILED' } });

    const missing = await createTransfer({ ...TRANSFER, concept: '', fromAccountId: 'x' }, KEY);
    expect(pointers(missing)).toEqual(expect.arrayContaining(['/concept', '/fromAccountId']));
    expect(api.calls).toHaveLength(0);
  });

  it('WEB-07 createTransfer rechaza un destino de tipo desconocido', async () => {
    const api = fakeApi();
    const result = await createTransfer({ ...TRANSFER, destination: { type: 'IBAN' } }, KEY);
    expect(result).toMatchObject({ ok: false, problem: { code: 'VALIDATION_FAILED' } });
    expect(api.calls).toHaveLength(0);
  });

  it.each([
    ['name', ''],
    ['alias', ''],
    ['clabe', '123'],
  ])('WEB-07 WEB-15 createBeneficiary rechaza %s inválido con su campo', async (field, value) => {
    const api = fakeApi();
    const result = await createBeneficiary({ ...BENEFICIARY_INPUT, [field]: value });
    expect(result).toMatchObject({ ok: false, problem: { code: 'VALIDATION_FAILED' } });
    expect(pointers(result)).toContain(`/${field}`);
    expect(api.calls).toHaveLength(0);
  });

  it('WEB-07 createBeneficiary rechaza campos de más y un cuerpo vacío', async () => {
    const api = fakeApi();
    expect(await createBeneficiary({ ...BENEFICIARY_INPUT, userId: 'otro' })).toMatchObject({
      ok: false,
      problem: { code: 'VALIDATION_FAILED' },
    });
    expect(await createBeneficiary(undefined)).toMatchObject({
      ok: false,
      problem: { code: 'VALIDATION_FAILED' },
    });
    expect(api.calls).toHaveLength(0);
  });

  it.each([
    [{ email: 'ana@example.com' }, '/password'],
    [{ email: 'no-es-correo', password: 'una contraseña larga' }, '/email'],
    [{ email: 'ana@example.com', password: 'una contraseña larga', role: 'admin' }, undefined],
  ])('WEB-07 WEB-12 login rechaza %j sin llamar a la API', async (body, pointer) => {
    const api = fakeApi();
    const result = await login(body);
    expect(result).toMatchObject({ ok: false, problem: { code: 'VALIDATION_FAILED' } });
    if (pointer) expect(pointers(result)).toContain(pointer);
    expect(api.calls).toHaveLength(0);
  });

  it('WEB-07 WEB-11 register rechaza un cuerpo vacío con errores de campo y sin llamar a la API', async () => {
    const api = fakeApi();
    const result = await register({});
    expect(result).toMatchObject({ ok: false, problem: { code: 'VALIDATION_FAILED' } });
    expect(pointers(result)?.length).toBeGreaterThan(1);
    expect(api.calls).toHaveLength(0);
  });

  it('WEB-07 WEB-08 el problema de validación solo lleva campos del contrato, sin entrada ni internos', async () => {
    fakeApi();
    const result = await login({ email: 'no-es-correo', password: 'secreto-que-no-debe-salir' });
    if (result.ok) throw new Error('debía fallar');
    expect(Object.keys(result.problem).sort()).toEqual(
      ['code', 'errors', 'requestId', 'status', 'title', 'type'].sort(),
    );
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('secreto-que-no-debe-salir');
    expect(serialized).not.toMatch(/stack|node_modules|ZodError/);
  });
});
