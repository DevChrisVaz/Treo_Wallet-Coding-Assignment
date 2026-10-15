import { afterEach, describe, expect, it } from 'vitest';
import nextConfig from '@/next.config';
import { securityHeaders, STRICT_TRANSPORT_SECURITY } from './security-headers';

const asMap = (headers: { key: string; value: string }[]) =>
  Object.fromEntries(headers.map(({ key, value }) => [key, value]));

describe('securityHeaders', () => {
  it('WEB-38 declara los cuatro headers y nunca HSTS, que depende de la configuración en ejecución', () => {
    const headers = asMap(securityHeaders());
    expect(headers).toEqual({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': expect.any(String),
    });
  });

  it('WEB-38 el valor de HSTS es de dos años, con subdominios y sin preload', () => {
    expect(STRICT_TRANSPORT_SECURITY).toBe('max-age=63072000; includeSubDomains');
    expect(STRICT_TRANSPORT_SECURITY).not.toContain('preload');
  });

  it('WEB-38 el Permissions-Policy no lista funciones que Chromium no reconoce', () => {
    const policy = asMap(securityHeaders())['Permissions-Policy'] ?? '';
    expect(policy).not.toContain('bluetooth');
  });

  it('WEB-38 el Permissions-Policy deshabilita cámara, micrófono, geolocalización y pagos', () => {
    const policy = asMap(securityHeaders())['Permissions-Policy'] ?? '';
    for (const feature of ['camera', 'microphone', 'geolocation', 'payment']) {
      expect(policy).toContain(`${feature}=()`);
    }
  });

  it('WEB-38 el Referrer-Policy no es no-referrer, que rompería el Origin de las Server Actions (WEB-06)', () => {
    const policy = asMap(securityHeaders())['Referrer-Policy'];
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

  it('WEB-38 el build no decide HSTS: headers() nunca lo emite, con o sin SESSION_COOKIE_SECURE', async () => {
    for (const value of ['true', 'false', undefined]) {
      if (value === undefined) delete process.env.SESSION_COOKIE_SECURE;
      else process.env.SESSION_COOKIE_SECURE = value;
      expect(asMap((await declared())[0]?.headers ?? [])).not.toHaveProperty(
        'Strict-Transport-Security',
      );
    }
  });

  it('WEB-38 sigue sin anunciar X-Powered-By', () => {
    expect(nextConfig('phase-production-server').poweredByHeader).toBe(false);
  });
});
