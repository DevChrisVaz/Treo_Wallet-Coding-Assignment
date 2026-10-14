import { Router } from 'express';
import request from 'supertest';
import { QueryFailedError } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { createHttpApp } from '../../../src/platform/http/app.js';
import { PgErrorTranslator, pgErrorOf } from '../../../src/platform/persistence/pg-errors.js';
import { DomainError } from '../../../src/shared/errors.js';
import { captureLogger } from '../../helpers/logs.js';

/** Error con la forma de `DatabaseError` del driver pg. */
function pgError(code: string, constraint?: string, message = 'error de PostgreSQL') {
  return Object.assign(new Error(message), { code, constraint, severity: 'ERROR' });
}

/** Error como lo envuelve TypeORM: `QueryFailedError` con el error del driver dentro. */
function typeormError(code: string, constraint?: string) {
  return new QueryFailedError('INSERT …', ['ana@example.com'], pgError(code, constraint));
}

function translator() {
  const logs = captureLogger();
  const instance = new PgErrorTranslator(logs.logger);
  return { instance, logs };
}

describe('PLT-04 traducción de errores de PostgreSQL por nombre de constraint', () => {
  it('PLT-04 extrae SQLSTATE y constraint del error del driver o del de TypeORM', () => {
    expect(pgErrorOf(pgError('23505', 'uq_users_email'))).toEqual({
      code: '23505',
      constraint: 'uq_users_email',
    });
    expect(pgErrorOf(typeormError('23514', 'ck_accounts_balance_non_negative'))).toEqual({
      code: '23514',
      constraint: 'ck_accounts_balance_non_negative',
    });
    expect(pgErrorOf(new Error('no es de PostgreSQL'))).toBeUndefined();
  });

  it('PLT-04 traduce una violación registrada al código del catálogo, usando solo el nombre', () => {
    const { instance } = translator();
    instance.register('uq_beneficiaries_user_alias', () => new DomainError('BENEFICIARY_CONFLICT'));
    // El mensaje habla de otra constraint: la traducción depende solo del nombre.
    const error = Object.assign(
      new Error('duplicate key value violates unique constraint "uq_users_email"'),
      { code: '23505', constraint: 'uq_beneficiaries_user_alias' },
    );
    const translated = instance.translate(error);
    expect(translated).toBeInstanceOf(DomainError);
    expect(translated?.code).toBe('BENEFICIARY_CONFLICT');
    expect(translated?.detail ?? '').not.toContain('uq_');
  });

  it('PLT-04 registra un log de error cuando la traducción indica que actuó la red de la base', () => {
    const { instance, logs } = translator();
    instance.register(
      'ck_accounts_balance_non_negative',
      () => new DomainError('INSUFFICIENT_FUNDS'),
      {
        logLevel: 'error',
      },
    );
    expect(
      instance.translate(typeormError('23514', 'ck_accounts_balance_non_negative'))?.code,
    ).toBe('INSUFFICIENT_FUNDS');
    expect(logs.entries()).toEqual([
      expect.objectContaining({ level: 'error', constraint: 'ck_accounts_balance_non_negative' }),
    ]);
  });

  it('PLT-04 una constraint sin traducción responde INTERNAL_ERROR y se registra como error', () => {
    const { instance, logs } = translator();
    expect(instance.translate(typeormError('23505', 'uq_desconocida'))?.code).toBe(
      'INTERNAL_ERROR',
    );
    expect(logs.entries()[0]).toMatchObject({ level: 'error', constraint: 'uq_desconocida' });
  });

  it.each([
    ['40P01', 'interbloqueo'],
    ['40001', 'serialización'],
    ['42501', 'permiso denegado'],
  ])('PLT-04 el SQLSTATE %s (%s) responde INTERNAL_ERROR con log de error', (code) => {
    const { instance, logs } = translator();
    expect(instance.translate(pgError(code))?.code).toBe('INTERNAL_ERROR');
    expect(logs.entries()[0]).toMatchObject({ level: 'error', sqlState: code });
  });

  it('PLT-04 deja pasar errores que no son de integridad para el manejador genérico', () => {
    const { instance } = translator();
    expect(instance.translate(pgError('22001'))).toBeUndefined();
    expect(instance.translate(new Error('cualquier cosa'))).toBeUndefined();
  });

  it('PLT-04 no permite registrar dos traducciones para la misma constraint', () => {
    const { instance } = translator();
    instance.register('uq_x', () => new DomainError('NOT_FOUND'));
    expect(() => instance.register('uq_x', () => new DomainError('NOT_FOUND'))).toThrow(/uq_x/);
  });
});

describe('PLT-04 traducción en la respuesta HTTP', () => {
  function appThrowing(error: unknown, translator: PgErrorTranslator, logger: CapturedLogger) {
    const router = Router();
    router.post('/operacion', () => {
      throw error;
    });
    return createHttpApp({
      trustedProxies: ['loopback'],
      routers: [router],
      logger,
      translateError: translator.translate,
    });
  }

  it('PLT-04 un permiso denegado responde 500 INTERNAL_ERROR y se registra como error', async () => {
    const { instance, logs } = translator();
    const res = await request(appThrowing(typeormError('42501'), instance, logs.logger)).post(
      '/operacion',
    );
    expect(res.status).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
    expect(logs.entries()).toContainEqual(
      expect.objectContaining({ level: 'error', sqlState: '42501' }),
    );
  });

  it('PLT-04 una unicidad registrada responde su código sin el nombre de la constraint', async () => {
    const { instance, logs } = translator();
    instance.register('uq_beneficiaries_user_alias', () => new DomainError('BENEFICIARY_CONFLICT'));
    const error = typeormError('23505', 'uq_beneficiaries_user_alias');
    const res = await request(appThrowing(error, instance, logs.logger)).post('/operacion');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('BENEFICIARY_CONFLICT');
    expect(JSON.stringify(res.body)).not.toContain('uq_');
  });
});

type CapturedLogger = ReturnType<typeof captureLogger>['logger'];
