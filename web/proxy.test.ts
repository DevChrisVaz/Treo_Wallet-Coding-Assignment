import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { config, CURRENT_PATH_HEADER, proxy } from './proxy';

describe('proxy', () => {
  it('WEB-22 pasa al servidor la ruta pedida para construir el regreso tras iniciar sesión', () => {
    const response = proxy(
      new NextRequest('http://localhost:3000/accounts/abc/movements?type=DEPOSIT'),
    );
    expect(response.headers.get(`x-middleware-request-${CURRENT_PATH_HEADER}`)).toBe(
      '/accounts/abc/movements?type=DEPOSIT',
    );
  });

  it('WEB-22 reemplaza el valor que envíe el navegador', () => {
    const response = proxy(
      new NextRequest('http://localhost:3000/beneficiaries', {
        headers: { [CURRENT_PATH_HEADER]: 'https://evil.example.com' },
      }),
    );
    expect(response.headers.get(`x-middleware-request-${CURRENT_PATH_HEADER}`)).toBe(
      '/beneficiaries',
    );
  });

  it('WEB-09 no corre en el BFF ni en los archivos estáticos', () => {
    expect(config.matcher).toEqual(['/((?!bff/|_next/|favicon.ico).*)']);
  });
});
