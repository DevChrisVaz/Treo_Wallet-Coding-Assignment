import { describe, expect, it } from 'vitest';
import {
  expectToMatchContract,
  operationIdFor,
  type ContractResponse,
} from '../../helpers/contract.js';

function response(overrides: Partial<ContractResponse>): ContractResponse {
  return {
    status: 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'x-request-id': 'r-1' },
    body: { status: 'ok' },
    text: '{"status":"ok"}',
    ...overrides,
  };
}

describe('PLT-12 validación de respuestas contra el contrato', () => {
  it('PLT-12 acepta una respuesta que cumple el esquema declarado', () => {
    expect(() => expectToMatchContract(response({}), 'healthCheck')).not.toThrow();
  });

  it('PLT-12 falla indicando la operación y el campo que no cumple', () => {
    expect(() =>
      expectToMatchContract(response({ body: { status: 'ko' } }), 'healthCheck'),
    ).toThrow(/healthCheck.*200[\s\S]*\/status/);
  });

  it('PLT-12 falla si el status no está declarado para la operación', () => {
    expect(() => expectToMatchContract(response({ status: 418 }), 'healthCheck')).toThrow(
      /healthCheck.*418/,
    );
  });

  it('PLT-12 falla si el Content-Type no es el declarado', () => {
    const problem = {
      type: '/problems/not-found',
      title: 'Recurso no encontrado',
      status: 404,
      code: 'NOT_FOUND',
      requestId: 'r-1',
    };
    expect(() =>
      expectToMatchContract(
        response({
          status: 404,
          body: problem,
          headers: { 'content-type': 'application/json', 'x-request-id': 'r-1' },
        }),
        'getAccount',
      ),
    ).toThrow(/application\/problem\+json/);
  });

  it('PLT-01 falla si el status del problem no coincide con el de la respuesta', () => {
    const problem = {
      type: '/problems/not-found',
      title: 'Recurso no encontrado',
      status: 400,
      code: 'NOT_FOUND',
      requestId: 'r-1',
    };
    expect(() =>
      expectToMatchContract(
        response({
          status: 404,
          body: problem,
          headers: { 'content-type': 'application/problem+json', 'x-request-id': 'r-1' },
        }),
        'getAccount',
      ),
    ).toThrow(/status/);
  });

  it('PLT-05 falla si falta X-Request-Id', () => {
    expect(() =>
      expectToMatchContract(
        response({ headers: { 'content-type': 'application/json' } }),
        'healthCheck',
      ),
    ).toThrow(/X-Request-Id/);
  });

  it('PLT-12 un 204 no debe traer cuerpo', () => {
    expect(() =>
      expectToMatchContract(response({ status: 204, body: {}, text: '' }), 'logout'),
    ).not.toThrow();
    expect(() =>
      expectToMatchContract(response({ status: 204, text: '{"x":1}' }), 'logout'),
    ).toThrow(/204/);
  });
});

describe('ACC-10 operación del contrato a partir del método y la ruta', () => {
  it.each([
    ['get', '/accounts', 'listAccounts'],
    ['get', '/accounts/2b1f6c1e-0000-4000-8000-000000000001', 'getAccount'],
    ['get', '/accounts/x/movements?limit=5&type=DEPOSIT', 'listAccountMovements'],
    ['post', '/beneficiaries', 'createBeneficiary'],
    ['get', '/beneficiaries', 'listBeneficiaries'],
    ['post', '/transfers', 'createTransfer'],
    ['get', '/transfers/abc', 'getTransfer'],
    ['post', '/transfers/abc/confirm', 'confirmTransfer'],
    ['post', '/transfers/abc/otp/resend', 'resendTransferOtp'],
  ])('ACC-10 %s %s es %s', (method, url, operationId) => {
    expect(operationIdFor(method, url)).toBe(operationId);
  });

  it('ACC-10 una ruta o un método que el contrato no declara no tienen operación', () => {
    expect(operationIdFor('delete', '/transfers/abc')).toBeUndefined();
    expect(operationIdFor('get', '/transfers/abc/confirm/extra')).toBeUndefined();
    expect(operationIdFor('get', '/no-existe')).toBeUndefined();
  });
});
