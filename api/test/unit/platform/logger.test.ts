import { Writable } from 'node:stream';
import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createHttpApp } from '../../../src/platform/http/app.js';
import { createLogger } from '../../../src/platform/logging/logger.js';
import { maskClabe, maskCurp, maskEmail, maskPhone, maskRfc } from '../../../src/shared/masking.js';

/** Logger que escribe en memoria; devuelve las líneas JSON emitidas. */
function captureLogger() {
  const lines: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, done) {
      lines.push(...String(chunk).trim().split('\n'));
      done();
    },
  });
  const logger = createLogger({ level: 'debug', destination });
  return { logger, lines, entries: () => lines.map((line) => JSON.parse(line)) };
}

const pii = {
  email: 'ana.gomez@example.com',
  phone: '+525512345678',
  curp: 'GOMC900101HDFNLR09',
  rfc: 'GOMC900101AB1',
  clabe: '999180000000000017',
};
const secrets = {
  password: 'contraseña-super-secreta',
  accessToken: 'eyJhbGciOiJIUzI1NiJ9.payload.firma',
  refreshToken: 'refresco-opaco-de-32-bytes-o-mas-xxxxxxxx',
  code: '493817',
  otp: '120934',
};

describe('PLT-06 enmascarado de datos personales', () => {
  it('PLT-06 deja visible solo un fragmento de cada dato', () => {
    expect(maskEmail('ana.gomez@example.com')).toBe('an***@example.com');
    expect(maskEmail('a@example.com')).toBe('a***@example.com');
    expect(maskPhone('+525512345678')).toBe('+52******5678');
    expect(maskCurp('GOMC900101HDFNLR09')).toBe('GOMC**************');
    expect(maskRfc('GOMC900101AB1')).toBe('GOMC*********');
    expect(maskClabe('999180000000000017')).toBe('**************0017');
  });
});

describe('PLT-06 logs estructurados', () => {
  it('PLT-06 emite una línea JSON por petición con requestId, método, ruta, status y duración', async () => {
    const { logger, entries } = captureLogger();
    const router = Router();
    router.get('/ping', (_req, res) => {
      res.status(204).end();
    });
    const app = createHttpApp({ trustedProxies: ['loopback'], routers: [router], logger });
    await request(app).get('/ping?x=1').set('X-Request-Id', 'req-logs-1');
    const line = entries().find((entry) => entry.msg === 'request completed');
    expect(line).toMatchObject({
      level: 'info',
      requestId: 'req-logs-1',
      method: 'GET',
      path: '/ping',
      status: 204,
    });
    expect(typeof line.durationMs).toBe('number');
    expect(typeof line.time).toBe('string');
  });

  it('PLT-05 los logs emitidos durante la petición llevan su requestId', async () => {
    const { logger, entries } = captureLogger();
    const router = Router();
    router.get('/work', (_req, res) => {
      logger.info({ step: 'trabajo' }, 'paso intermedio');
      res.status(204).end();
    });
    const app = createHttpApp({ trustedProxies: ['loopback'], routers: [router], logger });
    await request(app).get('/work').set('X-Request-Id', 'bff-123');
    expect(entries().find((entry) => entry.msg === 'paso intermedio')).toMatchObject({
      requestId: 'bff-123',
    });
  });

  it('PLT-06 reemplaza secretos por un marcador fijo y enmascara datos personales', () => {
    const { logger, lines, entries } = captureLogger();
    logger.info({ ...pii, ...secrets }, 'registro');
    logger.info({ user: { ...pii }, body: { ...secrets } }, 'anidado');
    logger.info({ input: { user: { ...pii, ...secrets } } }, 'más anidado');
    const output = lines.join('\n');
    for (const value of [...Object.values(pii), ...Object.values(secrets)]) {
      expect(output).not.toContain(value);
    }
    const [first] = entries();
    expect(first.password).toBe('[REDACTED]');
    expect(first.code).toBe('[REDACTED]');
    expect(first.email).toBe('an***@example.com');
    expect(first.clabe).toBe('**************0017');
  });

  it('PLT-06 el header Authorization nunca aparece en claro', async () => {
    const { logger, lines } = captureLogger();
    const router = Router();
    router.get('/secure', (req, res) => {
      logger.warn({ req: { headers: req.headers } }, 'cabeceras');
      res.status(204).end();
    });
    const app = createHttpApp({ trustedProxies: ['loopback'], routers: [router], logger });
    await request(app).get('/secure').set('Authorization', `Bearer ${secrets.accessToken}`);
    expect(lines.join('\n')).not.toContain(secrets.accessToken);
  });

  it('PLT-06 serializa bigint como string en lugar de fallar', () => {
    const { logger, entries } = captureLogger();
    logger.info({ amountCents: 9007199254740993n, nested: { balance: -5n } }, 'montos');
    expect(entries()[0]).toMatchObject({
      amountCents: '9007199254740993',
      nested: { balance: '-5' },
    });
  });

  it('PLT-06 los errores se registran sin parámetros de SQL ni detalles con datos', () => {
    const { logger, lines } = captureLogger();
    const error = Object.assign(new Error('duplicate key value violates unique constraint'), {
      code: '23505',
      constraint: 'uq_users_email',
      detail: `Key (email)=(${pii.email}) already exists.`,
      parameters: [pii.email, secrets.password],
      query: 'INSERT INTO users …',
    });
    logger.error({ err: error }, 'falla');
    const output = lines.join('\n');
    expect(output).toContain('uq_users_email');
    expect(output).toContain('"errorCode":"23505"');
    expect(output).toContain('stack');
    expect(output).not.toContain(pii.email);
    expect(output).not.toContain(secrets.password);
  });
});
