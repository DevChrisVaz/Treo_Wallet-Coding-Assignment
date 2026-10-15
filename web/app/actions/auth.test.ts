import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionStore } from '@/lib/server/session-store';
import { USER } from '@/test/fixtures';
import { fakeApi, jsonResponse, problemResponse } from '@/test/support/fake-api';
import { cookieValue, cookieWrites, resetRequest } from '@/test/support/next-headers';
import { SESSION_ID, sessionData, tokenPair } from '@/test/support/session';
import { login, logout, register, resendVerification, verifyEmail } from './auth';

vi.mock('next/headers', () => import('@/test/support/next-headers'));

const BROWSER = { 'x-request-id': 'bff-123', 'x-forwarded-for': '203.0.113.7' };
const CREDENTIALS = { email: 'ana@example.com', password: 'una contraseña larga' };
const AUTH_SESSION = { user: USER, tokens: tokenPair('login') };

beforeEach(async () => {
  await sessionStore().delete(SESSION_ID);
  resetRequest({ headers: BROWSER });
});

describe('login', () => {
  it('WEB-01 crea la sesión en el servidor y el navegador solo recibe una cookie con un id opaco', async () => {
    const api = fakeApi().on('POST', '/auth/login', () => jsonResponse(200, AUTH_SESSION));

    const result = await login(CREDENTIALS);

    expect(result).toEqual({ ok: true, data: { user: USER } });
    expect(JSON.stringify(result)).not.toContain(AUTH_SESSION.tokens.accessToken);
    expect(JSON.stringify(result)).not.toContain(AUTH_SESSION.tokens.refreshToken);
    const sessionId = cookieValue('sid');
    expect(sessionId).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sessionId).not.toContain(AUTH_SESSION.tokens.accessToken);
    expect(cookieWrites()[0]?.options).toMatchObject({ httpOnly: true, sameSite: 'strict' });
    const stored = await sessionStore().get(sessionId ?? '');
    expect(stored).toMatchObject({
      userId: USER.id,
      user: USER,
      accessToken: AUTH_SESSION.tokens.accessToken,
      refreshToken: AUTH_SESSION.tokens.refreshToken,
    });
    expect(api.calls[0]?.body).toEqual(CREDENTIALS);
  });

  it('WEB-10 la llamada a login lleva la IP del cliente en X-Forwarded-For', async () => {
    const api = fakeApi().on('POST', '/auth/login', () => jsonResponse(200, AUTH_SESSION));
    await login(CREDENTIALS);
    expect(api.calls[0]?.headers.get('x-forwarded-for')).toBe('203.0.113.7');
  });

  it('WEB-01 un login nuevo descarta la sesión anterior del mismo navegador', async () => {
    await sessionStore().set(SESSION_ID, sessionData());
    resetRequest({ headers: BROWSER, cookies: { sid: SESSION_ID } });
    fakeApi().on('POST', '/auth/login', () => jsonResponse(200, AUTH_SESSION));

    await login(CREDENTIALS);

    expect(await sessionStore().get(SESSION_ID)).toBeNull();
    expect(cookieValue('sid')).not.toBe(SESSION_ID);
  });

  it('WEB-12 con credenciales inválidas devuelve INVALID_CREDENTIALS y no crea sesión', async () => {
    fakeApi().on('POST', '/auth/login', () =>
      problemResponse(401, { code: 'INVALID_CREDENTIALS', requestId: 'api-1' }),
    );
    const result = await login(CREDENTIALS);
    expect(result).toMatchObject({ ok: false, problem: { code: 'INVALID_CREDENTIALS' } });
    expect(cookieWrites()).toEqual([]);
  });

  it('WEB-12 con el correo sin verificar devuelve EMAIL_NOT_VERIFIED', async () => {
    fakeApi().on('POST', '/auth/login', () =>
      problemResponse(403, { code: 'EMAIL_NOT_VERIFIED', requestId: 'api-1' }),
    );
    expect(await login(CREDENTIALS)).toMatchObject({
      ok: false,
      problem: { code: 'EMAIL_NOT_VERIFIED', status: 403 },
    });
  });

  it('WEB-07 un correo inválido no llega a la API', async () => {
    const api = fakeApi();
    const result = await login({ email: 'no-es-correo', password: 'x' });
    expect(result).toMatchObject({ ok: false, problem: { code: 'VALIDATION_FAILED' } });
    expect(api.calls).toHaveLength(0);
  });
});

describe('logout', () => {
  beforeEach(async () => {
    await sessionStore().set(SESSION_ID, sessionData());
    resetRequest({ headers: BROWSER, cookies: { sid: SESSION_ID } });
  });

  it('WEB-05 revoca la familia del refresh en la API, elimina la sesión y borra la cookie', async () => {
    const api = fakeApi().on('POST', '/auth/logout', () => new Response(null, { status: 204 }));

    const result = await logout();

    expect(result).toEqual({ ok: true, data: null });
    expect(api.calls[0]?.body).toEqual({ refreshToken: sessionData().refreshToken });
    expect(await sessionStore().get(SESSION_ID)).toBeNull();
    expect(cookieValue('sid')).toBeUndefined();
  });

  it('WEB-05 si la API no responde, elimina igualmente la sesión y la cookie', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fakeApi().on('POST', '/auth/logout', () => {
      throw new TypeError('fetch failed');
    });

    const result = await logout();

    expect(result).toEqual({ ok: true, data: null });
    expect(await sessionStore().get(SESSION_ID)).toBeNull();
    expect(cookieValue('sid')).toBeUndefined();
  });

  it('WEB-05 sin sesión no llama a la API y borra la cookie', async () => {
    resetRequest({ headers: BROWSER });
    const api = fakeApi();
    expect(await logout()).toEqual({ ok: true, data: null });
    expect(api.calls).toHaveLength(0);
  });
});

const REGISTRATION = {
  email: 'ana@example.com',
  password: 'contraseña-larga-1',
  firstNames: 'Ana',
  paternalSurname: 'Gómez',
  maternalSurname: 'Castillo',
  birthDate: '1990-01-01',
  birthState: 'DF',
  curp: 'GOMC900101HDFNLR09',
  rfc: 'GOMC900101AB1',
  phone: '5512345678',
};

const ACCEPTED = {
  message: 'Si los datos son correctos, recibirás un correo con las instrucciones.',
};

describe('register', () => {
  it('WEB-11 envía el registro validado y devuelve el mensaje genérico de la API', async () => {
    const api = fakeApi().on('POST', '/auth/register', () => jsonResponse(202, ACCEPTED));
    expect(await register(REGISTRATION)).toEqual({ ok: true, data: ACCEPTED });
    expect(api.calls[0]?.body).toEqual(REGISTRATION);
    expect(cookieWrites()).toEqual([]);
  });

  it('WEB-11 una CURP con dígito verificador inválido no llega a la API', async () => {
    const api = fakeApi();
    const result = await register({ ...REGISTRATION, curp: 'GOMC900101HDFNLR08' });
    expect(result).toMatchObject({ ok: false, problem: { code: 'VALIDATION_FAILED' } });
    expect(!result.ok && result.problem.errors?.[0]).toMatchObject({
      pointer: '/curp',
      code: 'INVALID_CHECK_DIGIT',
    });
    expect(api.calls).toHaveLength(0);
  });
});

describe('verifyEmail', () => {
  it('WEB-11 con el código correcto crea la sesión con los tokens recibidos', async () => {
    const api = fakeApi().on('POST', '/auth/verify-email', () => jsonResponse(200, AUTH_SESSION));

    const result = await verifyEmail({ email: 'ana@example.com', code: '123456' });

    expect(result).toEqual({ ok: true, data: { user: USER } });
    expect(api.calls[0]?.body).toEqual({ email: 'ana@example.com', code: '123456' });
    const stored = await sessionStore().get(cookieValue('sid') ?? '');
    expect(stored?.accessToken).toBe(AUTH_SESSION.tokens.accessToken);
  });

  it('WEB-11 un código incorrecto devuelve VERIFICATION_CODE_INVALID con los intentos restantes', async () => {
    fakeApi().on('POST', '/auth/verify-email', () =>
      problemResponse(422, {
        code: 'VERIFICATION_CODE_INVALID',
        attemptsRemaining: 2,
        requestId: 'api-1',
      }),
    );
    expect(await verifyEmail({ email: 'ana@example.com', code: '000000' })).toMatchObject({
      ok: false,
      problem: { code: 'VERIFICATION_CODE_INVALID', attemptsRemaining: 2 },
    });
    expect(cookieWrites()).toEqual([]);
  });

  it('WEB-11 un registro en revisión devuelve REGISTRATION_IN_REVIEW y no crea la sesión', async () => {
    fakeApi().on('POST', '/auth/verify-email', () =>
      problemResponse(403, { code: 'REGISTRATION_IN_REVIEW', requestId: 'api-1' }),
    );
    expect(await verifyEmail({ email: 'ana@example.com', code: '123456' })).toMatchObject({
      ok: false,
      problem: { code: 'REGISTRATION_IN_REVIEW', status: 403 },
    });
    expect(cookieWrites()).toEqual([]);
  });

  it('WEB-07 un código que no tiene 6 dígitos no llega a la API', async () => {
    const api = fakeApi();
    const result = await verifyEmail({ email: 'ana@example.com', code: '12345' });
    expect(result).toMatchObject({ ok: false, problem: { code: 'VALIDATION_FAILED' } });
    expect(api.calls).toHaveLength(0);
  });
});

describe('resendVerification', () => {
  it('WEB-11 pide el reenvío del código para el correo', async () => {
    const api = fakeApi().on('POST', '/auth/verify-email/resend', () =>
      jsonResponse(202, ACCEPTED),
    );
    expect(await resendVerification({ email: 'ana@example.com' })).toEqual({
      ok: true,
      data: ACCEPTED,
    });
    expect(api.calls[0]?.body).toEqual({ email: 'ana@example.com' });
  });

  it('WEB-07 un correo inválido no llega a la API', async () => {
    const api = fakeApi();
    expect(await resendVerification({ email: 'x' })).toMatchObject({
      ok: false,
      problem: { code: 'VALIDATION_FAILED' },
    });
    expect(api.calls).toHaveLength(0);
  });
});
