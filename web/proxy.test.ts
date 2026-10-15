import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

const page = () => new NextRequest('http://localhost:3000/login');
const policyOf = (response: Response) => response.headers.get('content-security-policy') ?? '';
const noncesOf = (policy: string) => [...policy.matchAll(/'nonce-([^']+)'/g)].map((m) => m[1]);

/** Módulo nuevo: la cookie segura se lee una sola vez por proceso, en la primera petición. */
async function freshProxy() {
  vi.resetModules();
  return (await import('./proxy')).proxy;
}

describe('proxy · Content-Security-Policy', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('WEB-39 SESSION_COOKIE_SECURE se lee una sola vez, no en cada petición', async () => {
    const fresh = await freshProxy();
    vi.stubEnv('SESSION_COOKIE_SECURE', 'false');
    expect(policyOf(fresh(page()))).not.toContain('upgrade-insecure-requests');
    vi.stubEnv('SESSION_COOKIE_SECURE', 'true');
    expect(policyOf(fresh(page()))).not.toContain('upgrade-insecure-requests');
  });

  it('WEB-39 cada petición recibe un nonce distinto, el mismo en script-src y en style-src', () => {
    const first = policyOf(proxy(page()));
    const second = policyOf(proxy(page()));
    const [scriptNonce, styleNonce] = noncesOf(first);
    expect(scriptNonce).toBeTruthy();
    expect(styleNonce).toBe(scriptNonce);
    expect(noncesOf(second)[0]).not.toBe(scriptNonce);
  });

  it('WEB-39 la política viaja en la respuesta y en la petición, con el nonce en x-nonce', () => {
    const response = proxy(page());
    const policy = policyOf(response);
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(policy);
    expect(response.headers.get('x-middleware-request-x-nonce')).toBe(noncesOf(policy)[0]);
  });

  it('WEB-39 la política de producción con HTTPS no permite unsafe-inline ni unsafe-eval en los scripts', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('API_BASE_URL', 'https://api.example.com');
    vi.stubEnv('SESSION_COOKIE_SECURE', 'true');
    const policy = policyOf((await freshProxy())(page()));
    const script = policy.split('; ').find((directive) => directive.startsWith('script-src')) ?? '';
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain('unsafe-inline');
    expect(script).not.toContain('unsafe-eval');
    expect(policy).toContain('upgrade-insecure-requests');
  });

  it('WEB-39 en desarrollo script-src permite unsafe-eval', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const script =
      policyOf(proxy(page()))
        .split('; ')
        .find((directive) => directive.startsWith('script-src')) ?? '';
    expect(script).toContain("'unsafe-eval'");
  });

  it('WEB-39 con HTTP en local no agrega upgrade-insecure-requests', async () => {
    vi.stubEnv('SESSION_COOKIE_SECURE', 'false');
    expect(policyOf((await freshProxy())(page()))).not.toContain('upgrade-insecure-requests');
  });

  it('WEB-39 la política fija el resto de las directivas', () => {
    const directives = policyOf(proxy(page())).split('; ');
    expect(directives).toEqual(
      expect.arrayContaining([
        "default-src 'self'",
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ]),
    );
  });

  it('WEB-39 WEB-22 conserva la ruta pedida junto con la política', () => {
    const response = proxy(new NextRequest('http://localhost:3000/beneficiaries?q=a'));
    expect(response.headers.get(`x-middleware-request-${CURRENT_PATH_HEADER}`)).toBe(
      '/beneficiaries?q=a',
    );
    expect(policyOf(response)).not.toBe('');
  });

  it('WEB-39 un Content-Security-Policy que envíe el navegador no se respeta', () => {
    const response = proxy(
      new NextRequest('http://localhost:3000/login', {
        headers: { 'content-security-policy': "default-src *; script-src 'unsafe-inline'" },
      }),
    );
    expect(response.headers.get('x-middleware-request-content-security-policy')).toBe(
      policyOf(response),
    );
    expect(policyOf(response)).not.toContain('unsafe-inline');
  });
});
