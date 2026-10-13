import { describe, expect, it, vi } from 'vitest';
import { createApiClient, createIdempotencyKey } from '../src/index';
import { fakeFetch } from './support/fake-fetch';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const transferBody = {
  fromAccountId: '6f1c2a3e-4b5d-4c6e-8f70-1a2b3c4d5e6f',
  destination: { type: 'BENEFICIARY', beneficiaryId: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d' },
  amount: '150.00',
  concept: 'Renta',
  reference: '1234567',
} as const;

describe('createIdempotencyKey', () => {
  it('CTR-06 genera un UUID con crypto.randomUUID cuando el entorno lo ofrece', () => {
    const first = createIdempotencyKey();
    const second = createIdempotencyKey();

    expect(first).toMatch(UUID);
    expect(first).not.toBe(second);
  });

  it('CTR-06 usa el generador inyectado por el consumidor', () => {
    expect(createIdempotencyKey(() => '9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f')).toBe(
      '9f8e7d6c-5b4a-4c3d-8e2f-1a0b9c8d7e6f',
    );
  });

  it('CTR-06 sin crypto.randomUUID ni generador falla con un mensaje claro', () => {
    vi.stubGlobal('crypto', {});
    try {
      expect(() => createIdempotencyKey()).toThrow(/generador/);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('Idempotency-Key en createTransfer', () => {
  it('CTR-06 el reintento tras un error de red envía exactamente la misma llave', async () => {
    let calls = 0;
    const { fetch, requests } = fakeFetch(() => {
      calls += 1;
      if (calls === 1) throw new TypeError('fetch failed');
      return Response.json({}, { status: 201 });
    });
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });
    const key = createIdempotencyKey();
    const send = () =>
      client.POST('/transfers', {
        params: { header: { 'Idempotency-Key': key } },
        body: transferBody,
      });

    await send().catch(() => undefined);
    await send();

    expect(requests.map((r) => r.headers.get('Idempotency-Key'))).toEqual([key, key]);
  });

  it('CTR-06 llamar createTransfer sin llave no compila', () => {
    const client = createApiClient({ baseUrl: 'http://api.test' });
    const withoutKey = () =>
      // @ts-expect-error falta params.header['Idempotency-Key']
      client.POST('/transfers', { body: transferBody });

    expect(typeof withoutKey).toBe('function');
  });
});
