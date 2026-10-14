import { readFileSync } from 'node:fs';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createHttpApp } from '../../../src/platform/http/app.js';
import { docsRouter } from '../../../src/platform/http/docs.js';
import { contractPath } from '../../helpers/contract.js';
import { captureLogger } from '../../helpers/logs.js';

function appFor(nodeEnv: 'development' | 'production') {
  return createHttpApp({
    trustedProxies: ['loopback'],
    routers: [docsRouter({ nodeEnv })],
    logger: captureLogger().logger,
  });
}

describe('PLT-11 documentación navegable del contrato', () => {
  it('PLT-11 fuera de producción sirve Swagger UI en /docs', async () => {
    const res = await request(appFor('development')).get('/docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('swagger-ui');
  });

  it('PLT-11 Swagger UI recibe todas las operaciones del contrato del paquete', async () => {
    const res = await request(appFor('development')).get('/docs/swagger-ui-init.js');
    expect(res.status).toBe(200);
    for (const operationId of [
      'healthCheck',
      'registerUser',
      'createTransfer',
      'listAccountMovements',
    ]) {
      expect(res.text).toContain(operationId);
    }
  });

  it('PLT-11 fuera de producción entrega /openapi.yaml idéntico al del paquete', async () => {
    const res = await request(appFor('development')).get('/openapi.yaml');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/yaml/);
    expect(res.text).toBe(readFileSync(contractPath, 'utf8'));
  });

  it('PLT-11 en producción /docs y /openapi.yaml responden 404', async () => {
    const app = appFor('production');
    for (const path of ['/docs', '/docs/', '/openapi.yaml']) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    }
  });
});
