import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createHttpApp } from '../../../src/platform/http/app.js';
import { healthRouter } from '../../../src/platform/http/health.js';
import { captureLogger } from '../../helpers/logs.js';

describe('PLT-10 salud del servicio', () => {
  it('PLT-10 GET /health responde 200 {"status":"ok"} sin token', async () => {
    const app = createHttpApp({
      trustedProxies: ['loopback'],
      routers: [healthRouter()],
      logger: captureLogger().logger,
    });
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/^application\/json/);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
