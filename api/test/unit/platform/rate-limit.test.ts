import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createHttpApp } from '../../../src/platform/http/app.js';
import { byIp, rateLimit } from '../../../src/platform/http/rate-limit.js';
import { FakeClock } from '../../helpers/fake-clock.js';
import { captureLogger } from '../../helpers/logs.js';

function limitedApp(clock: FakeClock) {
  const router = Router();
  router.get(
    '/limitado',
    rateLimit({ name: 'prueba', windowMs: 60_000, limit: 2, key: byIp, clock }),
    (_req, res) => {
      res.status(204).end();
    },
  );
  return createHttpApp({
    trustedProxies: ['loopback'],
    routers: [router],
    logger: captureLogger().logger,
  });
}

describe('PLT-09 límites de tasa', () => {
  it('PLT-09 al superar el límite responde 429 RATE_LIMITED con Retry-After en segundos', async () => {
    const clock = new FakeClock();
    const app = limitedApp(clock);
    expect((await request(app).get('/limitado')).status).toBe(204);
    clock.advance(15_000);
    expect((await request(app).get('/limitado')).status).toBe(204);
    const limited = await request(app).get('/limitado');
    expect(limited.status).toBe(429);
    expect(limited.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(limited.body).toMatchObject({ code: 'RATE_LIMITED', status: 429 });
    expect(limited.headers['retry-after']).toBe('45');
  });

  it('PLT-09 la ventana se reinicia cuando pasa el tiempo de Retry-After', async () => {
    const clock = new FakeClock();
    const app = limitedApp(clock);
    await request(app).get('/limitado');
    await request(app).get('/limitado');
    const limited = await request(app).get('/limitado');
    expect(limited.status).toBe(429);
    clock.advance(Number(limited.headers['retry-after']) * 1000);
    expect((await request(app).get('/limitado')).status).toBe(204);
  });

  it('PLT-09 cada cliente tiene su propio contador', async () => {
    const clock = new FakeClock();
    const app = limitedApp(clock);
    for (let i = 0; i < 2; i += 1) {
      await request(app).get('/limitado').set('X-Forwarded-For', '203.0.113.1');
    }
    expect((await request(app).get('/limitado').set('X-Forwarded-For', '203.0.113.1')).status).toBe(
      429,
    );
    expect((await request(app).get('/limitado').set('X-Forwarded-For', '203.0.113.2')).status).toBe(
      204,
    );
  });
});
