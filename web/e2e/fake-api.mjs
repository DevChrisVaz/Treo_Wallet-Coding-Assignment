#!/usr/bin/env node
// API simulada para las pruebas de navegador y la paridad de las pantallas reales (WEB-23, WEB-24,
// WEB-25): responde lo que la web pide al servidor con los datos canónicos de las historias. Nunca
// toca la base de datos. `POST /__scenario` cambia los datos (cuentas vacías, beneficiarios vacíos,
// una lectura que no responde, saldos de siete cifras en los movimientos) y reinicia el estado;
// `GET /__requests` devuelve las peticiones que recibió desde entonces (para comprobar lo que el BFF
// reenvía, como el `limit=5` de Inicio).
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

// Puerto de `--port <n>`; sin la bandera (o sin valor), 4999.
const portFlag = process.argv.indexOf('--port');
const port = Number.parseInt(
  (portFlag === -1 ? undefined : process.argv[portFlag + 1]) ?? '4999',
  10,
);

const user = {
  id: '6f1c2a8e-1d2b-4c3d-9e4f-5a6b7c8d9e0f',
  email: 'ana@example.com',
  fullName: 'Ana Gómez Castillo',
  phoneMasked: '+52******5678',
  curpMasked: 'GOCA**************',
  rfcMasked: 'GOCA*********',
  emailVerifiedAt: '2026-10-01T15:00:00Z',
  createdAt: '2026-10-01T14:55:00Z',
};
const principal = {
  id: '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a51',
  name: 'Principal',
  clabe: '646180157000009719',
  currency: 'MXN',
  createdAt: '2026-09-30T15:00:00Z',
};
const ahorro = {
  id: '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a52',
  name: 'Ahorro',
  clabe: '646180157000001234',
  balance: '10000.00',
  currency: 'MXN',
  createdAt: '2026-09-30T15:00:00Z',
};
const luis = {
  id: '5d1e7c3a-9b2f-4a6e-8c0d-1e2f3a4b5c61',
  name: 'Luis Pérez Ramírez',
  alias: 'Luis',
  clabe: '646180157000005678',
  createdAt: '2026-10-01T15:00:00Z',
};
const mama = {
  id: '5d1e7c3a-9b2f-4a6e-8c0d-1e2f3a4b5c62',
  name: 'María Gómez',
  alias: 'Mamá',
  clabe: '646180157000004321',
  createdAt: '2026-10-01T15:00:00Z',
};
const movements = [
  {
    id: 'mv-1',
    type: 'TRANSFER_OUT',
    amount: '-1250.00',
    balanceAfter: '25000.00',
    concept: 'Renta',
    reference: '1',
    counterparty: { name: 'Luis', clabeLast4: '5678' },
    transferId: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a',
    occurredAt: '2026-10-13T16:42:00Z',
  },
  {
    id: 'mv-2',
    type: 'TRANSFER_IN',
    amount: '450.00',
    balanceAfter: '26250.00',
    concept: 'Pago de la comida',
    reference: '9',
    counterparty: { name: 'Andrea Ruiz', clabeLast4: '8842' },
    transferId: '3b5d7f9a-1c2e-4b4d-8f6a-0c2e4a6b8d91',
    occurredAt: '2026-10-12T23:10:00Z',
  },
  {
    id: 'mv-3',
    type: 'TRANSFER_OUT',
    amount: '-150.00',
    balanceAfter: '25800.00',
    concept: 'Despensa',
    reference: '1',
    counterparty: { name: 'Mamá', clabeLast4: '4321' },
    transferId: '9b3e4c0a-7c2d-4e6a-8c7b-0a2f3e4d5c6b',
    occurredAt: '2026-10-12T15:05:00Z',
  },
  {
    id: 'mv-4',
    type: 'OWN_TRANSFER_OUT',
    amount: '-3000.00',
    balanceAfter: '25950.00',
    concept: 'Ahorro quincenal',
    reference: '15',
    counterparty: { name: 'Ahorro', clabeLast4: '1234' },
    transferId: '8a2d3b9f-6b1c-4d5f-9b6a-9f1e2d3c4b5a',
    occurredAt: '2026-10-09T18:20:00Z',
  },
  {
    id: 'mv-5',
    type: 'DEPOSIT',
    amount: '28950.00',
    balanceAfter: '28950.00',
    concept: 'Depósito inicial',
    reference: '1',
    counterparty: null,
    transferId: '1e2f3a4b-5c6d-4e7f-8a9b-0c1d2e3f4a5b',
    occurredAt: '2026-09-30T15:05:00Z',
  },
];
const sent = {
  id: '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a',
  status: 'COMPLETED',
  kind: 'THIRD_PARTY',
  fromAccountId: principal.id,
  destination: {
    type: 'BENEFICIARY',
    accountId: null,
    beneficiaryId: luis.id,
    displayName: 'Luis',
    clabeLast4: '5678',
  },
  amount: '1250.00',
  concept: 'Renta',
  reference: '1',
  requiresOtp: false,
  otp: null,
  rejectionReason: null,
  failureReason: null,
  createdAt: '2026-10-13T16:41:00Z',
  completedAt: '2026-10-13T16:42:00Z',
};
const challenge = {
  channel: 'EMAIL',
  deliveryStatus: 'SENT',
  maskedDestination: 'an***@example.com',
  expiresAt: '2026-10-13T18:05:00Z',
  attemptsRemaining: 3,
  resendsRemaining: 3,
};
const pending = {
  ...sent,
  id: '4c8e2f6a-1b3d-4e5f-9a7b-6c8d0e2f4a6b',
  status: 'PENDING_OTP',
  amount: '15000.00',
  requiresOtp: true,
  otp: challenge,
  createdAt: '2026-10-13T17:41:00Z',
  completedAt: null,
};
// Programada (WEB-34): $1,000.00 a Luis para el 20 de octubre de 2026, la que lista
// `GET /transfers/scheduled`.
const scheduled = {
  ...sent,
  id: '9a3b5c7d-2e4f-4a6b-8c0d-1e3f5a7b9c2d',
  status: 'SCHEDULED',
  amount: '1000.00',
  scheduledFor: '2026-10-20',
  cancelledAt: null,
  createdAt: '2026-10-13T16:50:00Z',
  completedAt: null,
};

const DEFAULTS = { accounts: 'ok', beneficiaries: 'ok', movements: 'ok' };
let scenario = { ...DEFAULTS };
let debited = false; // tras enviar los $1,250.00: Principal en $23,750.00 y el límite en $30,250.00
/** Peticiones recibidas desde el último `POST /__scenario` (método, ruta y query). */
let requests = [];

const later = (minutes) => new Date(Date.now() + minutes * 60_000).toISOString();
const tokens = () => ({
  tokenType: 'Bearer',
  accessToken: `access-${randomUUID()}`,
  accessTokenExpiresAt: later(60),
  refreshToken: `refresh-${randomUUID()}`.padEnd(43, 'r'),
  refreshTokenExpiresAt: later(7 * 24 * 60),
});

function overview() {
  if (scenario.accounts === 'empty') {
    return {
      accounts: [],
      dailyLimit: {
        limit: '50000.00',
        used: '0.00',
        remaining: '50000.00',
        resetsAt: '2026-10-14T06:00:00Z',
        timeZone: 'America/Mexico_City',
      },
    };
  }
  return {
    accounts: [{ ...principal, balance: debited ? '23750.00' : '25000.00' }, ahorro],
    dailyLimit: {
      limit: '50000.00',
      used: debited ? '19750.00' : '18500.00',
      remaining: debited ? '30250.00' : '31500.00',
      resetsAt: '2026-10-14T06:00:00Z',
      timeZone: 'America/Mexico_City',
    },
  };
}

function send(res, status, body, problem = false) {
  const headers = { 'X-Request-Id': randomUUID(), 'Cache-Control': 'no-store' };
  if (body === undefined) {
    res.writeHead(status, headers).end();
    return;
  }
  res
    .writeHead(status, {
      ...headers,
      'Content-Type': problem ? 'application/problem+json' : 'application/json',
    })
    .end(JSON.stringify(body));
}
const fail = (res, status, code, extra = {}) =>
  send(
    res,
    status,
    {
      type: `/problems/${code.toLowerCase().replace(/_/g, '-')}`,
      title: code,
      status,
      code,
      requestId: randomUUID(),
      ...extra,
    },
    true,
  );
const readBody = async (req) => {
  let text = '';
  for await (const chunk of req) text += chunk;
  return text ? JSON.parse(text) : {};
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname;
  const route = `${req.method} ${path}`;
  if (route === 'GET /health') return send(res, 200, { status: 'ok' });
  if (route === 'POST /__scenario') {
    scenario = { ...DEFAULTS, ...(await readBody(req)) };
    debited = false;
    requests = [];
    return send(res, 204);
  }
  if (route === 'GET /__requests') return send(res, 200, { items: requests });
  requests.push({ method: req.method, path, search: url.search });
  if (route === 'POST /auth/login' || route === 'POST /auth/verify-email')
    return send(res, 200, { user, tokens: tokens() });
  if (route === 'POST /auth/refresh') return send(res, 200, tokens());
  if (route === 'POST /auth/logout') return send(res, 204);
  if (route === 'POST /auth/register' || route === 'POST /auth/verify-email/resend')
    return send(res, 202, {
      message: 'Si los datos son correctos, recibirás un correo con las instrucciones.',
    });
  if (route === 'GET /me') return send(res, 200, user);
  if (route === 'GET /accounts') {
    if (scenario.accounts === 'hang') return undefined;
    return send(res, 200, overview());
  }
  const movementsPath = /^\/accounts\/([^/]+)\/movements$/.exec(path);
  if (req.method === 'GET' && movementsPath) {
    if (movementsPath[1] === ahorro.id) return send(res, 200, { items: [], nextCursor: null });
    if (movementsPath[1] !== principal.id) return fail(res, 404, 'NOT_FOUND');
    const filtered = ['from', 'to', 'type', 'cursor'].some((key) => url.searchParams.has(key));
    if (filtered) return send(res, 200, { items: [], nextCursor: null });
    const limit = url.searchParams.get('limit');
    // `movements: 'large'`: el mismo historial con "Saldo $1,250,000.00" en cada fila.
    const items =
      scenario.movements === 'large'
        ? movements.map((item) => ({ ...item, balanceAfter: '1250000.00' }))
        : movements;
    return send(res, 200, {
      items: limit ? items.slice(0, Number.parseInt(limit, 10)) : items,
      nextCursor: limit ? null : 'cursor-2',
    });
  }
  if (route === 'GET /beneficiaries')
    return send(res, 200, { items: scenario.beneficiaries === 'empty' ? [] : [luis, mama] });
  if (route === 'GET /transfers/scheduled') return send(res, 200, { items: [scheduled] });
  if (route === `GET /transfers/${sent.id}`) return send(res, 200, sent);
  if (route === `GET /transfers/${pending.id}`) return send(res, 200, pending);
  if (route === 'POST /transfers') {
    const { amount } = await readBody(req);
    const whole = String(amount).replace(/\.00$/, '');
    if (whole === '30000')
      return fail(res, 422, 'INSUFFICIENT_FUNDS', { transferId: randomUUID() });
    if (whole === '15000') return send(res, 201, pending);
    debited = whole === '1250';
    return send(
      res,
      201,
      whole === '1250' ? sent : { ...sent, id: randomUUID(), amount: String(amount) },
    );
  }
  if (route === `POST /transfers/${pending.id}/confirm`) {
    const { otp } = await readBody(req);
    if (otp === '000000') return fail(res, 422, 'OTP_ATTEMPTS_EXHAUSTED');
    return send(res, 200, {
      ...pending,
      status: 'COMPLETED',
      otp: null,
      completedAt: '2026-10-13T17:43:00Z',
    });
  }
  if (route === `POST /transfers/${pending.id}/otp/resend`) return send(res, 200, challenge);
  return fail(res, 404, 'NOT_FOUND');
}).listen(port, '127.0.0.1', () => console.log(`API simulada en http://127.0.0.1:${port}`));
