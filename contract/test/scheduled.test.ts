import { describe, expect, it } from 'vitest';
import { createApiClient, ProblemError, type Transfer } from '../src/index';
import { fakeFetch } from './support/fake-fetch';

const transferId = '3c2b1a09-8f7e-4d6c-9b5a-4f3e2d1c0b9a';

const scheduled: Transfer = {
  id: transferId,
  status: 'SCHEDULED',
  kind: 'THIRD_PARTY',
  fromAccountId: '6f1c2a3e-4b5d-4c6e-8f70-1a2b3c4d5e6f',
  destination: {
    type: 'BENEFICIARY',
    accountId: null,
    beneficiaryId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d',
    displayName: 'Luis',
    clabeLast4: '0031',
  },
  amount: '1000.00',
  concept: 'Renta',
  reference: '1234567',
  requiresOtp: false,
  otp: null,
  rejectionReason: null,
  failureReason: null,
  scheduledFor: '2026-10-20',
  cancelledAt: null,
  createdAt: '2026-10-14T18:00:00.000Z',
  completedAt: null,
};

describe('transferencias programadas', () => {
  it('CTR-04 createTransfer acepta scheduledFor', async () => {
    const { fetch, requests } = fakeFetch(() => Response.json(scheduled, { status: 201 }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    const { data } = await client.POST('/transfers', {
      params: { header: { 'Idempotency-Key': '0f0e0d0c-0b0a-4908-8706-050403020100' } },
      body: {
        fromAccountId: scheduled.fromAccountId,
        destination: { type: 'BENEFICIARY', beneficiaryId: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d' },
        amount: '1000',
        concept: 'Renta',
        reference: '1234567',
        scheduledFor: '2026-10-20',
      },
    });

    expect(await requests[0]?.json()).toMatchObject({ scheduledFor: '2026-10-20' });
    expect(data?.status).toBe('SCHEDULED');
  });

  it('CTR-04 listScheduledTransfers devuelve las programadas con su fecha', async () => {
    const { fetch, requests } = fakeFetch(() => Response.json({ items: [scheduled] }));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    const { data } = await client.GET('/transfers/scheduled');

    expect(requests[0]?.url).toBe('http://api.test/transfers/scheduled');
    expect(data?.items[0]).toMatchObject({ status: 'SCHEDULED', scheduledFor: '2026-10-20' });
  });

  it('CTR-04 cancelTransfer envía un POST a la acción de cancelar', async () => {
    const cancelled: Transfer = {
      ...scheduled,
      status: 'CANCELLED',
      cancelledAt: '2026-10-15T01:00:00.000Z',
    };
    const { fetch, requests } = fakeFetch(() => Response.json(cancelled));
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    const { data } = await client.POST('/transfers/{transferId}/cancel', {
      params: { path: { transferId } },
    });

    expect(requests[0]?.method).toBe('POST');
    expect(requests[0]?.url).toBe(`http://api.test/transfers/${transferId}/cancel`);
    expect(data?.status).toBe('CANCELLED');
  });

  it('CTR-07 TRANSFER_NOT_CANCELLABLE llega con el estado de la transferencia', async () => {
    const { fetch } = fakeFetch(() =>
      Response.json(
        {
          type: '/problems/transfer-not-cancellable',
          title: 'No se puede cancelar',
          status: 409,
          code: 'TRANSFER_NOT_CANCELLABLE',
          requestId: 'req-1',
          transferStatus: 'COMPLETED',
        },
        { status: 409, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    const error = await client
      .POST('/transfers/{transferId}/cancel', { params: { path: { transferId } } })
      .then(
        () => null,
        (rejection: unknown) => rejection,
      );

    expect(error).toBeInstanceOf(ProblemError);
    expect(error).toMatchObject({ code: 'TRANSFER_NOT_CANCELLABLE', transferStatus: 'COMPLETED' });
  });

  it('CTR-07 SCHEDULED_LIMIT_REACHED es un código conocido', async () => {
    const { fetch } = fakeFetch(() =>
      Response.json(
        {
          type: '/problems/scheduled-limit-reached',
          title: 'Tope de programadas',
          status: 422,
          code: 'SCHEDULED_LIMIT_REACHED',
          requestId: 'req-2',
        },
        { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    const error = await client.GET('/transfers/scheduled').then(
      () => null,
      (rejection: unknown) => rejection,
    );

    expect(error).toMatchObject({ code: 'SCHEDULED_LIMIT_REACHED' });
  });
});
