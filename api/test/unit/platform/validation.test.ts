import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import * as z from 'zod';
import { createHttpApp } from '../../../src/platform/http/app.js';
import { emailField, parseBody, textField } from '../../../src/platform/http/validation.js';
import { captureLogger } from '../../helpers/logs.js';

const loginLike = z.strictObject({
  email: emailField(),
  password: textField({ min: 1, max: 128 }),
});

function app() {
  const router = Router();
  router.post('/login-like', (req, res) => {
    const body = parseBody(loginLike, req.body);
    res.json(body);
  });
  return createHttpApp({
    trustedProxies: ['loopback'],
    routers: [router],
    logger: captureLogger().logger,
  });
}

describe('PLT-02 validación de entrada', () => {
  it('PLT-02 un cuerpo que no es JSON válido responde 400 MALFORMED_REQUEST', async () => {
    const res = await request(app())
      .post('/login-like')
      .set('Content-Type', 'application/json')
      .send('{"email": "ana@example.com",');
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body.code).toBe('MALFORMED_REQUEST');
  });

  it('PLT-02 una petición sin cuerpo JSON responde 400 MALFORMED_REQUEST', async () => {
    const res = await request(app()).post('/login-like').type('form').send('email=a');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MALFORMED_REQUEST');
  });

  it('PLT-02 un campo inválido se señala con su JSON Pointer', async () => {
    const res = await request(app())
      .post('/login-like')
      .send({ email: 'no-es-correo', password: 'x' });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(res.body.errors).toEqual([
      { pointer: '/email', code: 'INVALID_FORMAT', message: expect.any(String) },
    ]);
  });

  it('PLT-02 un campo no declarado responde 422 con el pointer de ese campo', async () => {
    const res = await request(app())
      .post('/login-like')
      .send({ email: 'ana@example.com', password: 'x', isAdmin: true });
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([
      { pointer: '/isAdmin', code: 'UNKNOWN_FIELD', message: expect.any(String) },
    ]);
  });

  it('PLT-02 distingue un campo faltante de uno con tipo inválido sin deducirlo del mensaje', async () => {
    const res = await request(app()).post('/login-like').send({ email: 12345 });
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        { pointer: '/email', code: 'INVALID_TYPE', message: expect.any(String) },
        { pointer: '/password', code: 'REQUIRED', message: expect.any(String) },
      ]),
    );
  });

  it('PLT-02 un JSON que no es objeto responde 422 en la raíz', async () => {
    const res = await request(app()).post('/login-like').send(['ana@example.com']);
    expect(res.status).toBe(422);
    expect(res.body.errors).toEqual([
      { pointer: '', code: 'INVALID_TYPE', message: expect.any(String) },
    ]);
  });

  it('PLT-02 entrega los valores ya transformados (email normalizado)', async () => {
    const res = await request(app())
      .post('/login-like')
      .send({ email: '  Ana@Example.COM ', password: 'x' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ email: 'ana@example.com', password: 'x' });
  });
});
