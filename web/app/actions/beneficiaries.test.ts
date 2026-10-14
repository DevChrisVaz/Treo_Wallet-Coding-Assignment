import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionStore } from '@/lib/server/session-store';
import { BENEFICIARY } from '@/test/fixtures';
import { fakeApi, jsonResponse, problemResponse } from '@/test/support/fake-api';
import { resetRequest } from '@/test/support/next-headers';
import { SESSION_ID, sessionData } from '@/test/support/session';
import { createBeneficiary } from './beneficiaries';

vi.mock('next/headers', () => import('@/test/support/next-headers'));

const BROWSER = { 'x-request-id': 'bff-123', 'x-forwarded-for': '203.0.113.7' };
const INPUT = { name: BENEFICIARY.name, alias: BENEFICIARY.alias, clabe: BENEFICIARY.clabe };

beforeEach(async () => {
  await sessionStore().delete(SESSION_ID);
  await sessionStore().set(SESSION_ID, sessionData());
  resetRequest({ headers: BROWSER, cookies: { sid: SESSION_ID } });
});

describe('createBeneficiary', () => {
  it('WEB-15 da de alta el beneficiario con la sesión del servidor', async () => {
    const api = fakeApi().on('POST', '/beneficiaries', () => jsonResponse(201, BENEFICIARY));

    expect(await createBeneficiary(INPUT)).toEqual({ ok: true, data: BENEFICIARY });
    expect(api.calls[0]?.body).toEqual(INPUT);
    expect(api.calls[0]?.headers.get('authorization')).toBe('Bearer access-token-1');
  });

  it('WEB-15 si ya existía con los mismos datos (200) también lo devuelve', async () => {
    fakeApi().on('POST', '/beneficiaries', () => jsonResponse(200, BENEFICIARY));
    expect(await createBeneficiary(INPUT)).toEqual({ ok: true, data: BENEFICIARY });
  });

  it('WEB-07 sin sesión responde UNAUTHENTICATED y la API no recibe la llamada', async () => {
    resetRequest({ headers: BROWSER });
    const api = fakeApi();
    expect(await createBeneficiary(INPUT)).toMatchObject({
      ok: false,
      problem: { code: 'UNAUTHENTICATED' },
    });
    expect(api.calls).toHaveLength(0);
  });

  it('WEB-07 WEB-15 una CLABE con dígito verificador incorrecto no llega a la API', async () => {
    const api = fakeApi();
    const result = await createBeneficiary({ ...INPUT, clabe: '032180000118359718' });
    expect(result).toMatchObject({ ok: false, problem: { code: 'VALIDATION_FAILED' } });
    expect(!result.ok && result.problem.errors?.[0]).toMatchObject({
      pointer: '/clabe',
      code: 'INVALID_CHECK_DIGIT',
    });
    expect(api.calls).toHaveLength(0);
  });

  it.each(['CLABE_INVALID', 'CLABE_NOT_IN_PLATFORM', 'BENEFICIARY_IS_OWN_ACCOUNT'] as const)(
    'WEB-15 devuelve el rechazo %s de la API',
    async (code) => {
      fakeApi().on('POST', '/beneficiaries', () =>
        problemResponse(422, { code, requestId: 'api-1' }),
      );
      expect(await createBeneficiary(INPUT)).toMatchObject({ ok: false, problem: { code } });
    },
  );

  it('WEB-15 devuelve BENEFICIARY_CONFLICT', async () => {
    fakeApi().on('POST', '/beneficiaries', () =>
      problemResponse(409, { code: 'BENEFICIARY_CONFLICT', requestId: 'api-1' }),
    );
    expect(await createBeneficiary(INPUT)).toMatchObject({
      ok: false,
      problem: { code: 'BENEFICIARY_CONFLICT', status: 409 },
    });
  });
});
