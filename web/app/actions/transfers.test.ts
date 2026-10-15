import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionStore } from '@/lib/server/session-store';
import { BENEFICIARY, PRINCIPAL, pendingOtpTransfer, transfer } from '@/test/fixtures';
import { fakeApi, jsonResponse, problemResponse } from '@/test/support/fake-api';
import { resetRequest } from '@/test/support/next-headers';
import { SESSION_ID, sessionData } from '@/test/support/session';
import { confirmTransfer, createTransfer, resendTransferOtp } from './transfers';

vi.mock('next/headers', () => import('@/test/support/next-headers'));

const BROWSER = { 'x-request-id': 'bff-123', 'x-forwarded-for': '203.0.113.7' };
const KEY = '9b2f0c1e-5a4d-4e3b-8c2a-1f0e9d8c7b6a';
const INPUT = {
  fromAccountId: PRINCIPAL.id,
  destination: { type: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id },
  amount: '5000.00',
  concept: 'Renta',
  reference: '1',
};
const TRANSFER_ID = transfer().id;

beforeEach(async () => {
  await sessionStore().delete(SESSION_ID);
  await sessionStore().set(SESSION_ID, sessionData());
  resetRequest({ headers: BROWSER, cookies: { sid: SESSION_ID } });
});

describe('createTransfer', () => {
  it('WEB-10 WEB-17 reenvía la Idempotency-Key recibida en una sola llamada a la API', async () => {
    const api = fakeApi().on('POST', '/transfers', () => jsonResponse(201, transfer()));

    const result = await createTransfer(INPUT, KEY);

    expect(result).toEqual({ ok: true, data: { transfer: transfer(), replayed: false } });
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]?.headers.get('idempotency-key')).toBe(KEY);
    expect(api.calls[0]?.headers.get('authorization')).toBe('Bearer access-token-1');
    expect(api.calls[0]?.body).toEqual(INPUT);
  });

  it('WEB-17 informa un 200 con Idempotent-Replayed: true como reintento', async () => {
    fakeApi().on('POST', '/transfers', () =>
      jsonResponse(200, pendingOtpTransfer(), { 'Idempotent-Replayed': 'true' }),
    );
    expect(await createTransfer(INPUT, KEY)).toEqual({
      ok: true,
      data: { transfer: pendingOtpTransfer(), replayed: true },
    });
  });

  it('WEB-07 un monto con 3 decimales devuelve VALIDATION_FAILED en /amount sin llamar a la API', async () => {
    const api = fakeApi();
    const result = await createTransfer({ ...INPUT, amount: '100.005' }, KEY);
    expect(result).toMatchObject({ ok: false, problem: { code: 'VALIDATION_FAILED' } });
    expect(!result.ok && result.problem.errors?.map((error) => error.pointer)).toEqual(['/amount']);
    expect(api.calls).toHaveLength(0);
  });

  it.each([
    [undefined, 'IDEMPOTENCY_KEY_MISSING'],
    ['', 'IDEMPOTENCY_KEY_MISSING'],
    ['no-es-uuid', 'IDEMPOTENCY_KEY_INVALID'],
  ])(
    'WEB-10 con la llave %j responde %s y la web no la genera por su cuenta',
    async (key, code) => {
      const api = fakeApi();
      expect(await createTransfer(INPUT, key)).toMatchObject({
        ok: false,
        problem: { code, status: 400 },
      });
      expect(api.calls).toHaveLength(0);
    },
  );

  it('WEB-10 WEB-17 ante un fallo de red no reintenta: una sola llamada y un 503 reintentable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const api = fakeApi().on('POST', '/transfers', () => {
      throw new TypeError('fetch failed');
    });

    const result = await createTransfer(INPUT, KEY);

    expect(result).toMatchObject({ ok: false, problem: { code: 'INTERNAL_ERROR', status: 503 } });
    expect(api.calls).toHaveLength(1);
  });

  it('WEB-08 WEB-16 devuelve INSUFFICIENT_FUNDS con el transferId', async () => {
    fakeApi().on('POST', '/transfers', () =>
      problemResponse(422, {
        code: 'INSUFFICIENT_FUNDS',
        transferId: TRANSFER_ID,
        requestId: 'api-1',
      }),
    );
    expect(await createTransfer(INPUT, KEY)).toMatchObject({
      ok: false,
      problem: { code: 'INSUFFICIENT_FUNDS', transferId: TRANSFER_ID },
    });
  });

  it('WEB-07 sin sesión no llama a la API', async () => {
    resetRequest({ headers: BROWSER });
    const api = fakeApi();
    expect(await createTransfer(INPUT, KEY)).toMatchObject({
      ok: false,
      problem: { code: 'UNAUTHENTICATED' },
    });
    expect(api.calls).toHaveLength(0);
  });
});

describe('createTransfer · programar', () => {
  const SCHEDULED_INPUT = { ...INPUT, amount: '1000.00', scheduledFor: '2026-10-20T20:30:00.000Z' };
  const scheduled = () =>
    transfer({ status: 'SCHEDULED', amount: '1000.00', scheduledFor: '2026-10-20T20:30:00.000Z' });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('WEB-33 WEB-10 envía scheduledFor con la Idempotency-Key del navegador', async () => {
    const api = fakeApi().on('POST', '/transfers', () => jsonResponse(201, scheduled()));

    const result = await createTransfer(SCHEDULED_INPUT, KEY);

    expect(result).toEqual({ ok: true, data: { transfer: scheduled(), replayed: false } });
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]?.body).toEqual(SCHEDULED_INPUT);
    expect(api.calls[0]?.headers.get('idempotency-key')).toBe(KEY);
  });

  it('WEB-33 WEB-17 dos envíos de la misma programación llevan la misma llave y la API devuelve la misma programada', async () => {
    let created = 0;
    const api = fakeApi().on('POST', '/transfers', () =>
      created++ === 0
        ? jsonResponse(201, scheduled())
        : jsonResponse(200, scheduled(), { 'Idempotent-Replayed': 'true' }),
    );

    const [first, second] = await Promise.all([
      createTransfer(SCHEDULED_INPUT, KEY),
      createTransfer(SCHEDULED_INPUT, KEY),
    ]);

    expect(api.calls.map((call) => call.headers.get('idempotency-key'))).toEqual([KEY, KEY]);
    expect(first.ok && first.data.transfer.id).toBe(scheduled().id);
    expect(second.ok && second.data.transfer.id).toBe(scheduled().id);
  });

  it('WEB-33 WEB-07 una fecha que no existe responde VALIDATION_FAILED en /scheduledFor sin llamar a la API', async () => {
    const api = fakeApi();
    const result = await createTransfer(
      { ...SCHEDULED_INPUT, scheduledFor: '2026-02-30T20:30:00.000Z' },
      KEY,
    );
    expect(result).toMatchObject({ ok: false, problem: { code: 'VALIDATION_FAILED' } });
    expect(!result.ok && result.problem.errors).toEqual([
      expect.objectContaining({ pointer: '/scheduledFor', code: 'INVALID_FORMAT' }),
    ]);
    expect(api.calls).toHaveLength(0);
  });

  it('WEB-33 WEB-17 el rango lo decide la API: un reintento después de medianoche llega a la API', async () => {
    // 00:30 del 20 de octubre en la Ciudad de México: la fecha ya es "hoy", pero la programación
    // pudo crearse ayer con esta llave; la API responde su estado actual (D4 de scheduled-transfers).
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T06:30:00.000Z'));
    // La sesión vigente a esa hora, para que el reloj fijo no la dé por expirada.
    await sessionStore().set(SESSION_ID, sessionData());
    const api = fakeApi().on('POST', '/transfers', () =>
      jsonResponse(200, scheduled(), { 'Idempotent-Replayed': 'true' }),
    );

    const result = await createTransfer(SCHEDULED_INPUT, KEY);

    expect(result).toEqual({ ok: true, data: { transfer: scheduled(), replayed: true } });
    expect(api.calls).toHaveLength(1);
  });

  it('WEB-33 WEB-08 devuelve DATE_OUT_OF_RANGE de la API con su campo', async () => {
    const errors = [
      {
        pointer: '/scheduledFor',
        code: 'DATE_OUT_OF_RANGE',
        message: 'Elige un momento entre 10 minutos y 90 días después de ahora',
      },
    ];
    fakeApi().on('POST', '/transfers', () =>
      problemResponse(422, { code: 'VALIDATION_FAILED', errors, requestId: 'api-1' }),
    );
    expect(await createTransfer(SCHEDULED_INPUT, KEY)).toMatchObject({
      ok: false,
      problem: { code: 'VALIDATION_FAILED', errors },
    });
  });

  it('WEB-33 WEB-08 devuelve SCHEDULED_LIMIT_REACHED de la API', async () => {
    fakeApi().on('POST', '/transfers', () =>
      problemResponse(422, { code: 'SCHEDULED_LIMIT_REACHED', requestId: 'api-1' }),
    );
    expect(await createTransfer(SCHEDULED_INPUT, KEY)).toMatchObject({
      ok: false,
      problem: { code: 'SCHEDULED_LIMIT_REACHED', requestId: 'api-1' },
    });
  });
});

describe('confirmTransfer · programada', () => {
  it('WEB-33 WEB-18 la confirmación de una programada devuelve su estado SCHEDULED', async () => {
    const scheduled = transfer({
      status: 'SCHEDULED',
      amount: '15000.00',
      scheduledFor: '2026-10-20T20:30:00.000Z',
    });
    fakeApi().on('POST', `/transfers/${TRANSFER_ID}/confirm`, () => jsonResponse(200, scheduled));
    expect(await confirmTransfer({ transferId: TRANSFER_ID, otp: '123456' })).toEqual({
      ok: true,
      data: scheduled,
    });
  });
});

describe('confirmTransfer', () => {
  it('WEB-18 confirma con el código y devuelve la transferencia', async () => {
    const api = fakeApi().on('POST', `/transfers/${TRANSFER_ID}/confirm`, () =>
      jsonResponse(200, transfer()),
    );

    expect(await confirmTransfer({ transferId: TRANSFER_ID, otp: '123456' })).toEqual({
      ok: true,
      data: transfer(),
    });
    expect(api.calls).toHaveLength(1);
    expect(api.calls[0]?.body).toEqual({ otp: '123456' });
  });

  it('WEB-18 devuelve OTP_INVALID con los intentos restantes', async () => {
    fakeApi().on('POST', `/transfers/${TRANSFER_ID}/confirm`, () =>
      problemResponse(422, { code: 'OTP_INVALID', attemptsRemaining: 1, requestId: 'api-1' }),
    );
    expect(await confirmTransfer({ transferId: TRANSFER_ID, otp: '000000' })).toMatchObject({
      ok: false,
      problem: { code: 'OTP_INVALID', attemptsRemaining: 1 },
    });
  });

  it('WEB-07 un código que no tiene 6 dígitos o un id inválido no llegan a la API', async () => {
    const api = fakeApi();
    expect(await confirmTransfer({ transferId: TRANSFER_ID, otp: '12' })).toMatchObject({
      ok: false,
      problem: { code: 'VALIDATION_FAILED' },
    });
    expect(await confirmTransfer({ transferId: '../x', otp: '123456' })).toMatchObject({
      ok: false,
      problem: { code: 'VALIDATION_FAILED' },
    });
    expect(api.calls).toHaveLength(0);
  });
});

describe('resendTransferOtp', () => {
  it('WEB-18 pide el reenvío y devuelve el nuevo reto', async () => {
    const challenge = { ...pendingOtpTransfer().otp, resendsRemaining: 2 };
    const api = fakeApi().on('POST', `/transfers/${TRANSFER_ID}/otp/resend`, () =>
      jsonResponse(202, challenge),
    );
    expect(await resendTransferOtp({ transferId: TRANSFER_ID })).toEqual({
      ok: true,
      data: challenge,
    });
    expect(api.calls).toHaveLength(1);
  });

  it('WEB-18 devuelve RESEND_LIMIT_REACHED', async () => {
    fakeApi().on('POST', `/transfers/${TRANSFER_ID}/otp/resend`, () =>
      problemResponse(422, { code: 'RESEND_LIMIT_REACHED', requestId: 'api-1' }),
    );
    expect(await resendTransferOtp({ transferId: TRANSFER_ID })).toMatchObject({
      ok: false,
      problem: { code: 'RESEND_LIMIT_REACHED' },
    });
  });
});
