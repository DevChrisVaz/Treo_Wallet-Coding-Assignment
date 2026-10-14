import { describe, expect, it } from 'vitest';
import { createApiClient, ProblemError } from '../src/index';
import { fakeFetch } from './support/fake-fetch';

const accountId = '6f1c2a3e-4b5d-4c6e-8f70-1a2b3c4d5e6f';
const statement = { params: { path: { accountId, period: '2026-09' } } } as const;
const pdfBytes = new TextEncoder().encode('%PDF-1.7\n% estado de cuenta\n%%EOF\n');

describe('descarga del estado de cuenta', () => {
  it('CTR-19 entrega el PDF como bytes, sin interpretarlo como JSON', async () => {
    const { fetch, requests } = fakeFetch(
      () =>
        new Response(pdfBytes, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="estado-de-cuenta-2026-09-5719.pdf"',
          },
        }),
    );
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    const { data, response } = await client.GET('/accounts/{accountId}/statements/{period}', {
      ...statement,
      parseAs: 'arrayBuffer',
    });

    expect(requests[0]?.url).toBe(`http://api.test/accounts/${accountId}/statements/2026-09`);
    expect(new Uint8Array(data as ArrayBuffer)).toEqual(pdfBytes);
    expect(new TextDecoder().decode((data as ArrayBuffer).slice(0, 5))).toBe('%PDF-');
    expect(response.headers.get('Content-Disposition')).toContain('estado-de-cuenta-2026-09');
  });

  it('CTR-19 entrega el PDF como stream', async () => {
    const { fetch } = fakeFetch(
      () => new Response(pdfBytes, { headers: { 'Content-Type': 'application/pdf' } }),
    );
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    const { data } = await client.GET('/accounts/{accountId}/statements/{period}', {
      ...statement,
      parseAs: 'stream',
    });

    const received = new Uint8Array(await new Response(data as ReadableStream).arrayBuffer());
    expect(received).toEqual(pdfBytes);
  });

  it('CTR-19 un error en la ruta del PDF llega como ProblemError', async () => {
    const { fetch } = fakeFetch(() =>
      Response.json(
        {
          type: '/problems/not-found',
          title: 'No encontrado',
          status: 404,
          code: 'NOT_FOUND',
          requestId: 'req-1',
        },
        { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
      ),
    );
    const client = createApiClient({ baseUrl: 'http://api.test', fetch });

    const error = await client
      .GET('/accounts/{accountId}/statements/{period}', { ...statement, parseAs: 'arrayBuffer' })
      .then(
        () => null,
        (rejection: unknown) => rejection,
      );

    expect(error).toBeInstanceOf(ProblemError);
    expect(error).toMatchObject({ status: 404, code: 'NOT_FOUND', requestId: 'req-1' });
  });
});
