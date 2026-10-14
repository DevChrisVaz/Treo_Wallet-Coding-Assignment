import type { IncomingMessage } from 'node:http';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { AuditWriter } from '../../../src/modules/audit/application/audit-writer.js';
import { PgAuditWriter } from '../../../src/modules/audit/infrastructure/pg-audit-writer.js';
import { buildTestApp, type TestApp } from '../../helpers/app.js';
import { auditEvents, leakedValues } from '../../helpers/audit.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { FakeClock } from '../../helpers/fake-clock.js';
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

// 31 de agosto de 2026, 23:55 en CDMX; las pruebas piden el estado de cuenta el 14 de octubre a las
// 12:00 en CDMX, cuando septiembre ya está cerrado y octubre es el mes en curso.
const AUGUST_31_LATE = '2026-09-01T05:55:00.000Z';
const OCTOBER_14_NOON = '2026-10-14T18:00:00.000Z';

/** Bytes para el PDF; JSON para los problem+json. supertest entrega el `IncomingMessage`. */
function bodyParser(
  res: request.Response,
  callback: (error: Error | null, body: unknown) => void,
): void {
  const stream = res as unknown as IncomingMessage;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk));
  stream.on('end', () => {
    const raw = Buffer.concat(chunks);
    const type = String(stream.headers['content-type'] ?? '');
    callback(null, type.startsWith('application/pdf') ? raw : JSON.parse(raw.toString('utf8')));
  });
}

async function login(t: TestApp, user: LedgerUser): Promise<string> {
  const res = await request(t.app)
    .post('/auth/login')
    .send({ email: user.person.email.toLowerCase(), password: user.person.password });
  expectToMatchContract(res, 'login');
  expect(res.status).toBe(200);
  return res.body.tokens.accessToken as string;
}

/** GET del estado de cuenta, validado contra `getAccountStatement` (`authed`). */
function getStatement(t: TestApp, token: string, accountId: string, period: string) {
  return authed(t, token)
    .get(`/accounts/${accountId}/statements/${period}`)
    .set('User-Agent', 'vitest-estado-de-cuenta')
    .buffer(true)
    .parse(bodyParser);
}

async function statementEvents() {
  return (await auditEvents(harness.migrator)).filter(
    (event) => event.action === 'STATEMENT_EXPORTED',
  );
}

/**
 * Ana cerró agosto con 1,000.00 en "Principal" y en septiembre recibió 500.00 de Luis y le envió
 * 150.00 (escenario de HIS-12). Devuelve un token de Ana del 14 de octubre.
 */
async function septemberScenario(t: TestApp) {
  const ana = await ledgerUser(t, harness);
  const luis = await ledgerUser(t, harness);
  await fund(t, ana.principal.id, '1000.00');
  await fund(t, luis.principal.id, '1000.00');
  t.clock.advance(6 * 60_000); // 1 de septiembre, 00:01 en CDMX
  const toLuis = await addBeneficiary(t, ana, {
    name: 'Luis',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
  const toAna = await addBeneficiary(t, luis, {
    name: 'Ana',
    alias: 'Ana',
    clabe: ana.principal.clabe,
  });
  for (const [from, beneficiaryId, amount] of [
    [luis, toAna, '500.00'],
    [ana, toLuis, '150.00'],
  ] as const) {
    t.clock.advance(1_000);
    const res = await postTransfer(t, from, {
      fromAccountId: from.principal.id,
      destination: { type: 'BENEFICIARY', beneficiaryId },
      amount,
      concept: 'Pago',
      reference: '1',
    });
    expect(res.body.status).toBe('COMPLETED');
  }
  t.clock.set(OCTOBER_14_NOON);
  return { ana, luis, token: await login(t, ana), luisToken: await login(t, luis) };
}

describe('HIS-11 ruta getAccountStatement', () => {
  let t: TestApp;

  beforeEach(async () => {
    t = await buildTestApp(harness, { now: AUGUST_31_LATE });
  });

  it('HIS-11 septiembre de "Principal": 200 application/pdf con %PDF-, no-store y el nombre estado-de-cuenta-2026-09-<últimos 4>.pdf', async () => {
    const { ana, token } = await septemberScenario(t);
    const res = await getStatement(t, token, ana.principal.id, '2026-09');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="estado-de-cuenta-2026-09-${ana.principal.clabe.slice(-4)}.pdf"`,
    );
    const bytes = res.body as Buffer;
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(Number(res.headers['content-length'])).toBe(bytes.length);
    expect(res.headers.etag).toBeUndefined();
  });

  it('HIS-12 el documento de la ruta cuadra con el ledger: $1,000.00 + $500.00 − $150.00 = $1,350.00 en 2 renglones', async () => {
    const { ana, token } = await septemberScenario(t);
    const res = await getStatement(t, token, ana.principal.id, '2026-09');
    const pages = await pdfPages(res.body as Buffer);
    const lines = pages.flatMap(linesOf);
    expect(lines).toContain('Saldo inicial $1,000.00');
    expect(lines).toContain('Abonos $500.00');
    expect(lines).toContain('Cargos $150.00');
    expect(lines).toContain('Saldo final $1,350.00');
    expect(lines).toContain(`CLABE ${ana.principal.clabe}`);
    expect(lines).toContain('Periodo 1 al 30 de septiembre de 2026');
    expect(lines).toContain('Generado el 14/10/2026 12:00 (hora de la Ciudad de México)');
    expect(lines.filter((line) => line.startsWith('01/09/2026 00:01'))).toEqual([
      '01/09/2026 00:01 Transferencia recibida Pago $500.00 $1,500.00',
      '01/09/2026 00:01 Transferencia enviada Pago $150.00 $1,350.00',
    ]);
  });

  it('HIS-11 el mes en curso cubre del 1 al 14 de octubre de 2026 y se identifica como parcial', async () => {
    const { ana, token } = await septemberScenario(t);
    const res = await getStatement(t, token, ana.principal.id, '2026-10');
    expect(res.status).toBe(200);
    const lines = (await pdfPages(res.body as Buffer)).flatMap(linesOf);
    expect(lines).toContain('Periodo 1 al 14 de octubre de 2026 (parcial)');
    expect(lines).toContain('Saldo inicial $1,350.00');
    expect(lines).toContain('Sin movimientos en el periodo');
  });

  it('HIS-11 la cuenta de Luis responde 404 NOT_FOUND y no audita (AUD-07)', async () => {
    const { luis, token } = await septemberScenario(t);
    const res = await getStatement(t, token, luis.principal.id, '2026-09');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
    const malformed = await getStatement(t, token, 'no-es-un-uuid', '2026-09');
    expect(malformed.status).toBe(404);
    expect(await statementEvents()).toEqual([]);
  });

  it('HIS-11 el 14 de octubre, 2026-11 es 422 VALIDATION_FAILED y 2026-13 también, en /period y sin auditar', async () => {
    const { ana, token } = await septemberScenario(t);
    const future = await getStatement(t, token, ana.principal.id, '2026-11');
    expect(future.status).toBe(422);
    expect(future.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [{ pointer: '/period', code: 'DATE_OUT_OF_RANGE' }],
    });
    const malformed = await getStatement(t, token, ana.principal.id, '2026-13');
    expect(malformed.status).toBe(422);
    expect(malformed.body).toMatchObject({
      code: 'VALIDATION_FAILED',
      errors: [{ pointer: '/period', code: 'INVALID_FORMAT' }],
    });
    expect(await statementEvents()).toEqual([]);
  });

  it('HIS-11 sin access token responde 401', async () => {
    const res = await request(t.app).get(
      '/accounts/7b1f0a52-3c1e-4d8e-9a55-2f7d1c3b9e10/statements/2026-09',
    );
    expectToMatchContract(res, 'getAccountStatement');
    expect(res.status).toBe(401);
  });

  it('HIS-11 la petición 11 del mismo usuario en un minuto responde 429 RATE_LIMITED con Retry-After, sin auditar', async () => {
    const { ana, token, luisToken, luis } = await septemberScenario(t);
    for (let i = 1; i <= 10; i++) {
      t.clock.advance(1_000);
      expect((await getStatement(t, token, ana.principal.id, '2026-09')).status).toBe(200);
    }
    const eleventh = await getStatement(t, token, ana.principal.id, '2026-09');
    expect(eleventh.status).toBe(429);
    expect(eleventh.body.code).toBe('RATE_LIMITED');
    const retryAfter = Number(eleventh.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
    expect(await statementEvents()).toHaveLength(10);

    // El límite es por usuario, no por IP: Luis, desde la misma IP, sí puede.
    expect((await getStatement(t, luisToken, luis.principal.id, '2026-09')).status).toBe(200);
    // Pasada la ventana, Ana vuelve a poder.
    t.clock.advance(retryAfter * 1_000);
    expect((await getStatement(t, token, ana.principal.id, '2026-09')).status).toBe(200);
  });

  it('AUD-07 la descarga registra STATEMENT_EXPORTED con actor USER, cuenta y periodo, sin CLABE, nombre ni montos', async () => {
    const { ana, token } = await septemberScenario(t);
    const res = await getStatement(t, token, ana.principal.id, '2026-09').set(
      'X-Request-Id',
      'req-estado-1',
    );
    expect(res.status).toBe(200);
    const events = await statementEvents();
    expect(events).toEqual([
      {
        actor_type: 'USER',
        actor_user_id: ana.userId,
        action: 'STATEMENT_EXPORTED',
        entity_type: 'ACCOUNT',
        entity_id: ana.principal.id,
        request_id: 'req-estado-1',
        ip: '127.0.0.1',
        user_agent: 'vitest-estado-de-cuenta',
        metadata: { period: '2026-09' },
      },
    ]);
    expect(
      leakedValues(events, [ana.principal.clabe, ana.person.fullName, '1350.00', '1,350.00']),
    ).toEqual([]);
  });
});

describe('AUD-07 falla al auditar', () => {
  it('AUD-07 si STATEMENT_EXPORTED no se puede registrar, responde 500 y no entrega el documento', async () => {
    const real = new PgAuditWriter(harness.app, new FakeClock(AUGUST_31_LATE));
    const failing: AuditWriter = {
      record: (tx, event) => real.record(tx, event),
      recordStandalone: async (event) => {
        if (event.action === 'STATEMENT_EXPORTED') throw new Error('la bitácora no responde');
        await real.recordStandalone(event);
      },
    };
    const t = await buildTestApp(harness, { now: AUGUST_31_LATE, overrides: { audit: failing } });
    const { ana, token } = await septemberScenario(t);
    const res = await getStatement(t, token, ana.principal.id, '2026-09');
    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(res.headers['content-disposition']).toBeUndefined();
    expect(await statementEvents()).toEqual([]);
  });
});
