import { describe, expect, it } from 'vitest';
import { appSection, loginPath, safeNextPath } from './navigation';

describe('safeNextPath', () => {
  it.each([
    '/',
    '/beneficiaries',
    '/accounts/0b7d6f5e-4c3b-4a29-8187-6f5e4d3c2b1a/movements?type=DEPOSIT',
    '/transfers/new',
  ])('WEB-22 acepta la ruta interna %s', (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    'https://evil.example.com',
    '//evil.example.com',
    '/\\evil.example.com',
    '\\\\evil.example.com',
    'javascript:alert(1)',
    'beneficiaries',
    '/login?next=/',
    '/%0d%0aSet-Cookie',
    '',
    undefined,
    ['/beneficiaries'],
  ])('WEB-22 ignora el destino %j y vuelve al resumen de cuentas', (value) => {
    expect(safeNextPath(value)).toBe('/');
  });
});

describe('loginPath', () => {
  it('WEB-22 lleva al inicio de sesión con la ruta de regreso', () => {
    expect(loginPath('/accounts/abc/movements?type=DEPOSIT')).toBe(
      '/login?next=%2Faccounts%2Fabc%2Fmovements%3Ftype%3DDEPOSIT',
    );
  });

  it('WEB-03 agrega el motivo de sesión expirada y omite el regreso al resumen', () => {
    expect(loginPath('/', 'expired')).toBe('/login?reason=expired');
    expect(loginPath('https://evil.example.com')).toBe('/login');
  });
});

const ID = '0b7d6f5e-4c3b-4a29-8187-6f5e4d3c2b1a';

describe('appSection', () => {
  it.each([
    ['/', { current: 'home', title: 'Inicio', mode: 'tabs', primary: 'transfer' }],
    [
      '/movements',
      { current: 'movements', title: 'Movimientos', mode: 'tabs', primary: 'transfer' },
    ],
    [
      `/accounts/${ID}/movements`,
      { current: 'movements', title: 'Movimientos', mode: 'tabs', primary: 'transfer' },
    ],
    [
      '/transfers/new',
      { current: 'transfer', title: 'Transferir', mode: 'flow', primary: 'transfer' },
    ],
    [
      `/transfers/${ID}`,
      { current: null, title: 'Transferencia', mode: 'tabs', primary: 'transfer' },
    ],
    [
      '/transfers/scheduled',
      {
        current: 'scheduled',
        title: 'Transferencias programadas',
        mode: 'tabs',
        primary: 'transfer',
      },
    ],
    [
      '/beneficiaries',
      { current: 'beneficiaries', title: 'Beneficiarios', mode: 'tabs', primary: 'beneficiary' },
    ],
    [
      '/beneficiaries/new',
      {
        current: 'beneficiaries',
        title: 'Agregar beneficiario',
        mode: 'tabs',
        primary: 'transfer',
      },
    ],
    ['/beneficiariesx', { current: 'home', title: 'Inicio', mode: 'tabs', primary: 'transfer' }],
  ] as const)('WEB-26 WEB-27 %s tiene su destino, su título y su forma', (path, expected) => {
    expect(appSection(path)).toEqual(expected);
  });
});
