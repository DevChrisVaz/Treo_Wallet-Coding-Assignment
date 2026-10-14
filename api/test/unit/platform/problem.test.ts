import { Router } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createHttpApp } from '../../../src/platform/http/app.js';
import { PROBLEM_CATALOG, toProblem } from '../../../src/platform/http/problem.js';
import { DomainError } from '../../../src/shared/errors.js';
import { contractEnum } from '../../helpers/contract.js';
import { captureLogger } from '../../helpers/logs.js';

function appWith(router: Router) {
  const logs = captureLogger();
  const app = createHttpApp({
    trustedProxies: ['loopback'],
    routers: [router],
    logger: logs.logger,
  });
  return { app, logs };
}

describe('PLT-01 formato de errores RFC 9457', () => {
  it('PLT-01 cada código del catálogo del contrato tiene status y título en español', () => {
    const codes = contractEnum('ProblemCode');
    expect(Object.keys(PROBLEM_CATALOG).sort()).toEqual([...codes].sort());
    for (const code of codes) {
      const entry = PROBLEM_CATALOG[code as keyof typeof PROBLEM_CATALOG];
      expect(entry.status).toBeGreaterThanOrEqual(400);
      expect(entry.title).toMatch(/[a-záéíóúñ]/);
    }
  });

  it('PLT-01 un error de negocio responde problem+json con type, title, status, code y requestId', async () => {
    const router = Router();
    router.post('/negocio', () => {
      throw new DomainError('INSUFFICIENT_FUNDS', 'El saldo no alcanza', {
        transferId: '6f1c1d4e-0d55-4a7a-9f4b-2b8c9d1e2f3a',
      });
    });
    const res = await request(appWith(router).app)
      .post('/negocio')
      .set('X-Request-Id', 'req-problem-1');
    expect(res.status).toBe(422);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body).toEqual({
      type: '/problems/insufficient-funds',
      title: 'Saldo insuficiente',
      status: 422,
      detail: 'El saldo no alcanza',
      instance: '/negocio',
      code: 'INSUFFICIENT_FUNDS',
      requestId: 'req-problem-1',
      transferId: '6f1c1d4e-0d55-4a7a-9f4b-2b8c9d1e2f3a',
    });
  });

  it('PLT-01 un error lanzado por un handler asíncrono también se traduce', async () => {
    const router = Router();
    router.get('/async', async () => {
      await Promise.resolve();
      throw new DomainError('NOT_FOUND');
    });
    const res = await request(appWith(router).app).get('/async');
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('PLT-01 una ruta inexistente responde 404 NOT_FOUND en problem+json', async () => {
    const res = await request(appWith(Router()).app).get('/no-existe');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(res.body).toMatchObject({ code: 'NOT_FOUND', status: 404 });
    expect(res.body.requestId).toBe(res.headers['x-request-id']);
  });

  it('PLT-01 las extensiones solo aparecen en los códigos que el contrato indica', () => {
    const problem = toProblem(
      new DomainError('NOT_FOUND', undefined, {
        transferId: '6f1c1d4e-0d55-4a7a-9f4b-2b8c9d1e2f3a',
        attemptsRemaining: 2,
      }),
      { requestId: 'r', instance: '/x' },
    );
    expect(problem).not.toHaveProperty('transferId');
    expect(problem).not.toHaveProperty('attemptsRemaining');
  });
});

describe('PLT-03 errores internos sin detalles', () => {
  it('PLT-03 una excepción inesperada responde 500 sin traza ni mensaje original', async () => {
    const router = Router();
    router.get('/explota', () => {
      throw new Error('SELECT * FROM app.users falló en /srv/api/src/secreto.ts');
    });
    const { app, logs } = appWith(router);
    const res = await request(app).get('/explota').set('X-Request-Id', 'req-boom-1');
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({
      code: 'INTERNAL_ERROR',
      status: 500,
      requestId: 'req-boom-1',
    });
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('SELECT');
    expect(body).not.toContain('secreto.ts');
    expect(body).not.toContain('at ');

    const errorLine = logs.entries().find((entry) => entry.msg === 'unhandled error') as
      { requestId: string; err: { message: string; stack: string } } | undefined;
    expect(errorLine?.requestId).toBe('req-boom-1');
    expect(errorLine?.err.message).toContain('SELECT * FROM app.users');
    expect(errorLine?.err.stack).toContain('problem.test.ts');
  });
});
