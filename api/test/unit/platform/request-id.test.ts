import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { currentRequestContext } from '../../../src/platform/context/request-context.js';
import { createHttpApp } from '../../../src/platform/http/app.js';
import { captureLogger } from '../../helpers/logs.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function appWithEcho() {
  const router = Router();
  router.get('/echo', (_req, res) => {
    res.json({ requestId: currentRequestContext()?.requestId ?? null });
  });
  return createHttpApp({
    trustedProxies: ['loopback'],
    routers: [router],
    logger: captureLogger().logger,
  });
}

describe('PLT-05 identificador de petición', () => {
  it('PLT-05 reutiliza un X-Request-Id válido del cliente', async () => {
    const res = await request(appWithEcho()).get('/echo').set('X-Request-Id', 'bff-123');
    expect(res.headers['x-request-id']).toBe('bff-123');
    expect(res.body).toEqual({ requestId: 'bff-123' });
  });

  it('PLT-05 acepta hasta 64 caracteres de [A-Za-z0-9_-]', async () => {
    const id = `${'a'.repeat(32)}_${'B'.repeat(29)}-9`;
    expect(id).toHaveLength(64);
    const res = await request(appWithEcho()).get('/echo').set('X-Request-Id', id);
    expect(res.headers['x-request-id']).toBe(id);
  });

  it('PLT-05 genera uno nuevo si no viene', async () => {
    const res = await request(appWithEcho()).get('/echo');
    expect(res.headers['x-request-id']).toMatch(UUID);
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it.each([
    ['con espacios', 'id con espacios'],
    ['con salto de línea codificado', 'abc%0Ainjected'],
    ['de 65 caracteres', 'a'.repeat(65)],
    ['con caracteres de log', '{"level":"fatal"}'],
  ])('PLT-05 genera uno nuevo si el del cliente es inválido (%s)', async (_case, invalid) => {
    const res = await request(appWithEcho()).get('/echo').set('X-Request-Id', invalid);
    expect(res.headers['x-request-id']).toMatch(UUID);
    expect(res.headers['x-request-id']).not.toBe(invalid);
  });

  it('PLT-05 cada petición sin identificador recibe uno distinto', async () => {
    const app = appWithEcho();
    const [a, b] = await Promise.all([request(app).get('/echo'), request(app).get('/echo')]);
    expect(a.headers['x-request-id']).not.toBe(b.headers['x-request-id']);
  });
});
