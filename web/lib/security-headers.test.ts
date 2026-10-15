import { afterEach, describe, expect, it } from 'vitest';
import nextConfig from '@/next.config';
import { securityHeaders } from './security-headers';

const asMap = (headers: { key: string; value: string }[]) =>
  Object.fromEntries(headers.map(({ key, value }) => [key, value]));

describe('securityHeaders', () => {
  it('WEB-38 sin HTTPS declara los cuatro headers y no HSTS', () => {
    const headers = asMap(securityHeaders({ secure: false }));
    expect(headers).toEqual({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': expect.any(String),
    });
  });

  it('WEB-38 con HTTPS agrega Strict-Transport-Security de dos años con subdominios y sin preload', () => {
    const headers = asMap(securityHeaders({ secure: true }));
    expect(headers['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains');
    expect(headers['Strict-Transport-Security']).not.toContain('preload');
  });

  it('WEB-38 el Permissions-Policy deshabilita cámara, micrófono, geolocalización y pagos', () => {
    const policy = asMap(securityHeaders({ secure: false }))['Permissions-Policy'] ?? '';
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment']) {
      expect(policy).toContain(`${feature}=()`);
    }
  });

  it('WEB-38 el Referrer-Policy no es no-referrer, que rompería el Origin de las Server Actions (WEB-06)', () => {
    const policy = asMap(securityHeaders({ secure: false }))['Referrer-Policy'];
    expect(policy).not.toBe('no-referrer');
    expect(policy).toBe('strict-origin-when-cross-origin');
  });
});

describe('next.config headers()', () => {
  const original = process.env.SESSION_COOKIE_SECURE;
  afterEach(() => {
    if (original === undefined) delete process.env.SESSION_COOKIE_SECURE;
    else process.env.SESSION_COOKIE_SECURE = original;
  });

  async function declared() {
    const config = nextConfig('phase-production-server');
    const rules = await config.headers?.();
    return rules ?? [];
  }

  it('WEB-38 aplica los headers a toda ruta, incluidas /bff y /_next', async () => {
    delete process.env.SESSION_COOKIE_SECURE;
    const rules = await declared();
    expect(rules).toHaveLength(1);
    // `/:path*` casa con la raíz y con cualquier ruta, también con las que el proxy excluye.
    expect(rules[0]?.source).toBe('/:path*');
    expect(asMap(rules[0]?.headers ?? [])).toHaveProperty('X-Frame-Options', 'DENY');
  });

  it('WEB-38 HSTS solo cuando SESSION_COOKIE_SECURE es verdadero', async () => {
    process.env.SESSION_COOKIE_SECURE = 'true';
    expect(asMap((await declared())[0]?.headers ?? [])).toHaveProperty('Strict-Transport-Security');
    process.env.SESSION_COOKIE_SECURE = 'false';
    expect(asMap((await declared())[0]?.headers ?? [])).not.toHaveProperty(
      'Strict-Transport-Security',
    );
  });

  it('WEB-38 sigue sin anunciar X-Powered-By', () => {
    expect(nextConfig('phase-production-server').poweredByHeader).toBe(false);
  });
});
