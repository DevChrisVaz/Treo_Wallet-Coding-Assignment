import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, testRateLimits, type TestApp } from '../../helpers/app.js';
import { useIntegrationHarness } from '../../helpers/harness.js';
import {
  addBeneficiary,
  fund,
  ledgerUser,
  postTransfer,
  type LedgerUser,
} from '../../helpers/ledger-api.js';
import { signInAgain } from '../../helpers/scheduled.js';

const harness = useIntegrationHarness();
let t: TestApp;
let ana: LedgerUser;
let luis: LedgerUser;
let beneficiaryId: string;

async function setUp(createMax: number) {
  t = await buildTestApp(harness, {
    now: '2026-10-13T18:00:00.000Z',
    config: { rateLimits: testRateLimits({ transferCreateMax: createMax }) },
  });
  ana = await ledgerUser(t, harness);
  luis = await ledgerUser(t, harness);
  beneficiaryId = await addBeneficiary(t, ana, {
    name: 'Luis Pérez',
    alias: 'Luis',
    clabe: luis.principal.clabe,
  });
  await fund(t, ana.principal.id, '5000.00');
}

const body = () => ({
  fromAccountId: ana.principal.id,
  destination: { type: 'BENEFICIARY', beneficiaryId },
  amount: '10.00',
  concept: 'Pago',
  reference: '1',
});

async function transferCount(): Promise<number> {
  const [row] = await harness.migrator.query(
    `SELECT count(*)::int AS n FROM app.transfers WHERE user_id = $1`,
    [ana.userId],
  );
  return row.n as number;
}

describe('TRF-37 límite de creación de transferencias', () => {
  beforeEach(() => setUp(3));

  it('TRF-37 la creación que excede el tope responde 429 con Retry-After y no crea nada', async () => {
    for (let i = 0; i < 3; i += 1) expect((await postTransfer(t, ana, body())).status).toBe(201);
    const res = await postTransfer(t, ana, body());
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    expect(await transferCount()).toBe(3);
  });

  it('TRF-37 la ventana de 10 minutos se reinicia con el reloj', async () => {
    for (let i = 0; i < 4; i += 1) await postTransfer(t, ana, body());
    t.clock.advance(9 * 60_000);
    expect((await postTransfer(t, ana, body())).status).toBe(429);
    t.clock.advance(60_000);
    // El access token dura 10 minutos: se inicia sesión de nuevo (el login tiene su propio límite).
    const again = await signInAgain(t, ana);
    expect((await postTransfer(t, again, body())).status).toBe(201);
  });

  it('TRF-37 el contador es por usuario: otro usuario crea aunque el primero esté agotado', async () => {
    for (let i = 0; i < 4; i += 1) await postTransfer(t, ana, body());
    await fund(t, luis.principal.id, '100.00');
    const toAna = await addBeneficiary(t, luis, {
      name: 'Ana Gómez',
      alias: 'Ana',
      clabe: ana.principal.clabe,
    });
    const res = await postTransfer(t, luis, {
      fromAccountId: luis.principal.id,
      destination: { type: 'BENEFICIARY', beneficiaryId: toAna },
      amount: '5.00',
      concept: 'Pago',
      reference: '2',
    });
    expect(res.status).toBe(201);
  });

  it('TRF-37 repetir la misma llave cuenta como petición', async () => {
    const key = crypto.randomUUID();
    expect((await postTransfer(t, ana, body(), key)).status).toBe(201);
    expect((await postTransfer(t, ana, body(), key)).headers['idempotent-replayed']).toBe('true');
    expect((await postTransfer(t, ana, body(), key)).status).toBe(200);
    const res = await postTransfer(t, ana, body(), key);
    expect(res.status).toBe(429);
  });

  it('TRF-37 una petición sin access token responde 401 y no gasta el cupo del usuario', async () => {
    for (let i = 0; i < 6; i += 1) {
      const res = await request(t.app)
        .post('/transfers')
        .set('Idempotency-Key', crypto.randomUUID())
        .send(body());
      expect(res.status).toBe(401);
    }
    expect((await postTransfer(t, ana, body())).status).toBe(201);
  });

  it('TRF-37 una petición inválida también cuenta, porque el límite va antes de validar', async () => {
    for (let i = 0; i < 3; i += 1) {
      expect((await postTransfer(t, ana, { ...body(), amount: 'abc' })).status).toBe(422);
    }
    expect((await postTransfer(t, ana, body())).status).toBe(429);
  });
});

describe('TRF-37 reintentos legítimos con los topes por defecto', () => {
  beforeEach(() => setUp(30));

  it('TRF-37 seis peticiones con la misma llave (el envío y sus cinco reintentos) no reciben 429', async () => {
    const key = crypto.randomUUID();
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) statuses.push((await postTransfer(t, ana, body(), key)).status);
    expect(statuses).toEqual([201, 200, 200, 200, 200, 200]);
  });
});
