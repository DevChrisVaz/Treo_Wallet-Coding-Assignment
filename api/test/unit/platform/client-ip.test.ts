import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { currentRequestContext } from '../../../src/platform/context/request-context.js';
import { createHttpApp } from '../../../src/platform/http/app.js';
import { captureLogger } from '../../helpers/logs.js';

function appTrusting(trustedProxies: string[]) {
  const router = Router();
  router.get('/ip', (_req, res) => {
    res.json({ ip: currentRequestContext()?.ip });
  });
  return createHttpApp({ trustedProxies, routers: [router], logger: captureLogger().logger });
}

describe('PLT-07 IP del cliente solo desde proxies de confianza', () => {
  it('PLT-07 ignora X-Forwarded-For de un cliente que no es proxy de confianza', async () => {
    // Las pruebas se conectan desde loopback, que aquí no está en la lista de confianza.
    const res = await request(appTrusting(['10.0.0.1']))
      .get('/ip')
      .set('X-Forwarded-For', '1.2.3.4');
    expect(res.body.ip).not.toBe('1.2.3.4');
    expect(res.body.ip).toMatch(/^(::ffff:)?127\.0\.0\.1$|^::1$/);
  });

  it('PLT-07 usa la IP del navegador que reenvía el BFF de confianza', async () => {
    const res = await request(appTrusting(['loopback']))
      .get('/ip')
      .set('X-Forwarded-For', '203.0.113.9');
    expect(res.body.ip).toBe('203.0.113.9');
  });

  it('PLT-07 un X-Forwarded-For falsificado antes del BFF no desplaza la IP real', async () => {
    // El navegador inventa "6.6.6.6"; el BFF agrega la IP real al final de la cadena.
    const res = await request(appTrusting(['loopback']))
      .get('/ip')
      .set('X-Forwarded-For', '6.6.6.6, 203.0.113.9');
    expect(res.body.ip).toBe('203.0.113.9');
  });
});
