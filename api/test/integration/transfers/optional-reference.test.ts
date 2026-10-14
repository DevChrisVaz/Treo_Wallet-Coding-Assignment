import type { IncomingMessage } from 'node:http';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  authed,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';
import { linesOf, pdfPages } from '../../helpers/pdf.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;
let beneficiaryId: string;

beforeEach(async () => {
  t = await buildTestApp(harness, { now: '2026-10-14T18:00:00.000Z' });
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  await fund(t, ana.principal.id, '5000.00');
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
});

const toLuis = (extra: Record<string, unknown> = {}) => ({
  fromAccountId: ana.principal.id,
  destination: { type: 'BENEFICIARY', beneficiaryId },
  amount: '100.00',
  concept: 'Renta',
  ...extra,
});

async function storedReference(id: string): Promise<number | null> {
  const [row] = await harness.migrator.query('SELECT reference FROM app.transfers WHERE id = $1', [
    id,
  ]);
  return row.reference;
}

describe('TRF-09 referencia opcional de punta a punta', () => {
  it('TRF-09 sin referencia: 201, la respuesta trae reference null y la base guarda NULL', async () => {
    const res = await postTransfer(t, ana, toLuis());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: 'COMPLETED', reference: null });
    expect(await storedReference(res.body.id)).toBeNull();
  });

  it('TRF-09 una referencia vacía equivale a omitirla', async () => {
    const res = await postTransfer(t, ana, toLuis({ reference: '' }));
    expect(res.status).toBe(201);
    expect(res.body.reference).toBeNull();
    expect(await storedReference(res.body.id)).toBeNull();
  });

  it('TRF-09 con referencia la respuesta la devuelve como texto', async () => {
    const res = await postTransfer(t, ana, toLuis({ reference: '1234567' }));
    expect(res.status).toBe(201);
    expect(res.body.reference).toBe('1234567');
    const shown = await authed(t, ana.accessToken).get(`/transfers/${res.body.id}`);
    expect(shown.body.reference).toBe('1234567');
  });

  it('TRF-26, TRF-09 el comprobante GET /transfers/{id} de una sin referencia también trae null', async () => {
    const created = await postTransfer(t, ana, toLuis());
    const shown = await authed(t, ana.accessToken).get(`/transfers/${created.body.id}`);
    expect(shown.status).toBe(200);
    expect(shown.body.reference).toBeNull();
  });

  it('TRF-09, TRF-03 idempotencia: omitir la referencia y mandarla vacía es la misma petición; con referencia es otra', async () => {
    const key = crypto.randomUUID();
    const first = await postTransfer(t, ana, toLuis(), key);
    const sameEmpty = await postTransfer(t, ana, toLuis({ reference: '' }), key);
    expect(sameEmpty.status).toBe(200);
    expect(sameEmpty.body.id).toBe(first.body.id);
    expect(sameEmpty.headers['idempotent-replayed']).toBe('true');

    const withReference = await postTransfer(t, ana, toLuis({ reference: '5' }), key);
    expect(withReference.status).toBe(422);
    expect(withReference.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('HIS-03, TRF-09 el historial muestra reference null (movimiento sin referencia) y el texto cuando la hay', async () => {
    await postTransfer(t, ana, toLuis());
    await postTransfer(t, ana, toLuis({ reference: '77' }));
    const res = await authed(t, ana.accessToken).get(`/accounts/${ana.principal.id}/movements`);
    expect(res.status).toBe(200);
    const outgoing = res.body.items.filter((m: { type: string }) => m.type === 'TRANSFER_OUT');
    expect(outgoing.map((m: { reference: string | null }) => m.reference).sort()).toEqual([
      '77',
      null,
    ]);
    // El fondeo de la Tesorería tampoco tiene referencia.
    const funding = res.body.items.find((m: { type: string }) => m.type === 'FUNDING_IN');
    expect(funding?.reference ?? null).toBeNull();
  });

  it('TRF-27, TRF-09 programada sin referencia: scheduledFor ISO y reference null', async () => {
    const res = await postTransfer(t, ana, toLuis({ scheduledFor: '2026-10-20T14:30:00-06:00' }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      status: 'SCHEDULED',
      reference: null,
      scheduledFor: '2026-10-20T20:30:00.000Z',
    });
  });

  it('HIS-12, TRF-09 el estado de cuenta no imprime "null" ni "Referencia" en los renglones sin referencia, pero sí en los que la tienen', async () => {
    await postTransfer(t, ana, toLuis({ concept: 'Sin ref' }));
    await postTransfer(t, ana, toLuis({ concept: 'Con ref', reference: '4321' }));
    const res = await authed(t, ana.accessToken)
      .get(`/accounts/${ana.principal.id}/statements/2026-10`)
      .buffer(true)
      .parse((response, callback) => {
        const stream = response as unknown as IncomingMessage;
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    const lines = (await pdfPages(res.body as Buffer)).flatMap(linesOf);
    const text = lines.join('\n');
    expect(text).not.toMatch(/null/i);
    expect(text).not.toContain('Referencia 0');
    expect(text.match(/Referencia 4321/g)).toHaveLength(1);
    expect(text.match(/Referencia/g)).toHaveLength(1);
  });
});

describe('TRF-08 monto inválido en la API', () => {
  it.each([
    ['con letras', '12abc'],
    ['solo letras', 'cien'],
    ['con símbolos', '$100.00'],
    ['con porcentaje', '10%'],
    ['con 3 decimales', '100.005'],
    ['con separador de miles', '1,000.00'],
    ['con signo', '-5.00'],
    ['vacío', ''],
  ])(
    'TRF-08 un monto %s responde 422 VALIDATION_FAILED en /amount y no crea nada',
    async (_c, amount) => {
      const res = await postTransfer(t, ana, toLuis({ amount }));
      expect(res.status).toBe(422);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(res.body.errors).toEqual([expect.objectContaining({ pointer: '/amount' })]);
      const [{ n }] = await harness.migrator.query(
        `SELECT count(*)::int AS n FROM app.transfers WHERE user_id = $1`,
        [ana.userId],
      );
      expect(n).toBe(0);
    },
  );
});

describe('TRF-16 códigos de 6 dígitos del OTP de transferencia', () => {
  it.each([
    ['con letras', 'abcdef'],
    ['de 5 dígitos', '12345'],
    ['de 7 dígitos', '1234567'],
    ['con espacio', '123 56'],
  ])('TRF-16 un código %s responde 422 en /otp', async (_c, otp) => {
    const res = await request(t.app)
      .post(`/transfers/${crypto.randomUUID()}/confirm`)
      .set('Authorization', `Bearer ${ana.accessToken}`)
      .send({ otp });
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([expect.objectContaining({ pointer: '/otp' })]);
  });
});
