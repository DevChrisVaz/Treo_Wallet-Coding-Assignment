import { SignJWT } from 'jose';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { JoseAccessTokens } from '../../../src/modules/identity/infrastructure/jose-access-tokens.js';
import { currentRequestContext } from '../../../src/platform/context/request-context.js';
import { createHttpApp } from '../../../src/platform/http/app.js';
import {
  assertPublicRoutesAllowed,
  authenticate,
  routeTable,
} from '../../../src/platform/http/auth.js';
import { expectToMatchContract } from '../../helpers/contract.js';
import { FakeClock } from '../../helpers/fake-clock.js';
import { captureLogger } from '../../helpers/logs.js';

const secret = Buffer.alloc(32, 21);
const options = { secret, issuer: 'wallet-api', audience: 'wallet-clients' };
const USER = '7c9e6679-7425-40de-944b-e07fc1f90ae7';

function setup() {
  const clock = new FakeClock('2026-10-13T18:00:00.000Z');
  const tokens = new JoseAccessTokens(options);
  const routes = routeTable(authenticate(tokens, clock));
  routes.get('/protegido', (_req, res) => {
    res.json({ userId: currentRequestContext()?.userId ?? null });
  });
  routes.public.post('/auth/publico', (_req, res) => {
    res.status(204).end();
  });
  const app = createHttpApp({
    trustedProxies: ['loopback'],
    routers: [routes.router],
    logger: captureLogger().logger,
  });
  return { app, clock, tokens, routes };
}

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

describe('IDN-09 access token de vida corta', () => {
  it('IDN-09 emite un JWT HS256 con sub, iss, aud, iat, exp y jti que vence en 10 minutos', async () => {
    const { tokens, clock } = setup();
    const issued = await tokens.issue(USER, clock.now());
    const [header, payload] = issued.token
      .split('.')
      .slice(0, 2)
      .map((part) => JSON.parse(Buffer.from(part, 'base64url').toString()));
    expect(header).toMatchObject({ alg: 'HS256' });
    expect(payload).toMatchObject({
      sub: USER,
      iss: 'wallet-api',
      aud: 'wallet-clients',
      iat: 1_791_914_400,
      exp: 1_791_914_400 + 600,
    });
    expect(payload.jti).toMatch(/^[0-9a-f-]{36}$/);
    expect(issued.expiresAt.toISOString()).toBe('2026-10-13T18:10:00.000Z');
  });

  it('IDN-09 un token válido autentica la petición y deja el usuario en el contexto', async () => {
    const { app, tokens, clock } = setup();
    const { token } = await tokens.issue(USER, clock.now());
    const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ userId: USER });
  });

  it('IDN-09 un token con "alg": "none" responde 401 UNAUTHENTICATED', async () => {
    const { app } = setup();
    const now = 1_791_914_400;
    const token = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({
      sub: USER,
      iss: 'wallet-api',
      aud: 'wallet-clients',
      iat: now,
      exp: now + 600,
      jti: 'x',
    })}.`;
    const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('IDN-09 un token usado 10 minutos y 1 segundo después de emitido responde 401', async () => {
    const { app, tokens, clock } = setup();
    const { token } = await tokens.issue(USER, clock.now());
    clock.advance(9 * 60_000 + 59_000);
    expect(
      (await request(app).get('/protegido').set('Authorization', `Bearer ${token}`)).status,
    ).toBe(200);
    clock.advance(2_000);
    const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it.each([
    ['otra audiencia', { audience: 'otra-app' }, 'HS256', secret],
    ['otro emisor', { issuer: 'otra-api' }, 'HS256', secret],
    ['otro secreto', {}, 'HS256', Buffer.alloc(32, 99)],
    ['otro algoritmo HMAC', {}, 'HS512', Buffer.alloc(64, 21)],
  ])('IDN-09 rechaza un token con %s', async (_case, claims, alg, key) => {
    const { app } = setup();
    const now = 1_791_914_400;
    const token = await new SignJWT({})
      .setProtectedHeader({ alg })
      .setSubject(USER)
      .setIssuer((claims as { issuer?: string }).issuer ?? 'wallet-api')
      .setAudience((claims as { audience?: string }).audience ?? 'wallet-clients')
      .setIssuedAt(now)
      .setExpirationTime(now + 600)
      .setJti('j')
      .sign(key);
    const res = await request(app).get('/protegido').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });
});

describe('IDN-10 rutas protegidas por defecto', () => {
  it('IDN-10 una ruta protegida sin header Authorization responde 401 UNAUTHENTICATED', async () => {
    const { app } = setup();
    const res = await request(app).get('/protegido');
    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('IDN-10 un esquema distinto de Bearer o un token vacío responden 401', async () => {
    const { app } = setup();
    for (const value of ['Basic dXNlcjpwYXNz', 'Bearer', 'Bearer ', 'bearer x.y.z']) {
      expect((await request(app).get('/protegido').set('Authorization', value)).status).toBe(401);
    }
  });

  it('IDN-10 las rutas públicas no piden token y una ruta inexistente sigue siendo 404', async () => {
    const { app } = setup();
    expect((await request(app).post('/auth/publico')).status).toBe(204);
    const missing = await request(app).get('/no-existe');
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('NOT_FOUND');
  });

  it('IDN-10 una ruta pública fuera de la lista permitida impide arrancar', () => {
    const { routes } = setup();
    routes.public.get('/accounts', (_req, res) => {
      res.end();
    });
    expect(() => assertPublicRoutesAllowed(routes.table)).toThrow(/GET \/accounts/);
  });

  it('IDN-10 la respuesta 401 cumple el contrato', async () => {
    const { app } = setup();
    const res = await request(app).get('/protegido');
    // /me es la ruta protegida de identidad; su 401 tiene la misma forma.
    expectToMatchContract(res, 'getCurrentUser');
  });
});
