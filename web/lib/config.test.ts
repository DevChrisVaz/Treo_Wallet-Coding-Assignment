import {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} from 'next/constants';
import { describe, expect, it, vi } from 'vitest';
import nextConfig from '../next.config';
import { allowedOriginHosts, parseServerEnv } from './config';

describe('parseServerEnv', () => {
  it('WEB-09 toma el host de la API de API_BASE_URL, sin la diagonal final', () => {
    const env = parseServerEnv({ API_BASE_URL: 'https://api.example.com/' });
    expect(env.apiBaseUrl).toBe('https://api.example.com');
  });

  it('WEB-09 usa http://localhost:4000 en desarrollo cuando falta API_BASE_URL', () => {
    expect(parseServerEnv({ NODE_ENV: 'development' }).apiBaseUrl).toBe('http://localhost:4000');
  });

  it('WEB-09 exige API_BASE_URL en producción', () => {
    expect(() => parseServerEnv({ NODE_ENV: 'production' })).toThrow(/API_BASE_URL/);
  });

  it.each([
    'ftp://api.example.com',
    'https://api.example.com/v1',
    'https://api.example.com?x=1',
    'no-es-url',
  ])('WEB-09 rechaza API_BASE_URL %s (solo un origen http o https)', (value) => {
    expect(() => parseServerEnv({ API_BASE_URL: value })).toThrow(/API_BASE_URL/);
  });

  it('WEB-06 lee ALLOWED_ORIGINS como lista de orígenes separados por comas', () => {
    const env = parseServerEnv({
      ALLOWED_ORIGINS: ' https://wallet.example.com , https://proxy.example.com:8443 ',
    });
    expect(env.allowedOrigins).toEqual([
      'https://wallet.example.com',
      'https://proxy.example.com:8443',
    ]);
  });

  it('WEB-06 deja ALLOWED_ORIGINS vacío por defecto (solo el propio origen)', () => {
    expect(parseServerEnv({}).allowedOrigins).toEqual([]);
  });

  it('WEB-06 rechaza un origen permitido con ruta o sin protocolo http(s)', () => {
    expect(() => parseServerEnv({ ALLOWED_ORIGINS: 'https://ok.example.com/ruta' })).toThrow(
      /ALLOWED_ORIGINS/,
    );
    expect(() => parseServerEnv({ ALLOWED_ORIGINS: 'ok.example.com' })).toThrow(/ALLOWED_ORIGINS/);
  });

  it('WEB-03 usa 15 minutos de inactividad por defecto y acepta otro entero positivo', () => {
    expect(parseServerEnv({}).sessionIdleMinutes).toBe(15);
    expect(parseServerEnv({ SESSION_IDLE_MINUTES: '5' }).sessionIdleMinutes).toBe(5);
    expect(() => parseServerEnv({ SESSION_IDLE_MINUTES: '0' })).toThrow(/SESSION_IDLE_MINUTES/);
    expect(() => parseServerEnv({ SESSION_IDLE_MINUTES: '1.5' })).toThrow(/SESSION_IDLE_MINUTES/);
  });

  it('WEB-02 SESSION_COOKIE_SECURE es true por defecto en producción y false en desarrollo', () => {
    expect(
      parseServerEnv({ NODE_ENV: 'production', API_BASE_URL: 'https://api.example.com' })
        .sessionCookieSecure,
    ).toBe(true);
    expect(parseServerEnv({ NODE_ENV: 'development' }).sessionCookieSecure).toBe(false);
    expect(parseServerEnv({ SESSION_COOKIE_SECURE: 'true' }).sessionCookieSecure).toBe(true);
    expect(() => parseServerEnv({ SESSION_COOKIE_SECURE: 'yes' })).toThrow(/SESSION_COOKIE_SECURE/);
  });

  it('WEB-09 nombra todas las variables inválidas en un solo error', () => {
    let message = '';
    try {
      parseServerEnv({ API_BASE_URL: 'x', SESSION_IDLE_MINUTES: '-1', ALLOWED_ORIGINS: 'y' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('API_BASE_URL');
    expect(message).toContain('ALLOWED_ORIGINS');
    expect(message).toContain('SESSION_IDLE_MINUTES');
  });
});

describe('allowedOriginHosts', () => {
  it('WEB-06 convierte cada origen en el host que compara Next.js', () => {
    expect(
      allowedOriginHosts(['https://wallet.example.com', 'https://proxy.example.com:8443']),
    ).toEqual(['wallet.example.com', 'proxy.example.com:8443']);
  });
});

describe('next.config', () => {
  it('WEB-06 serverActions.allowedOrigins sale de ALLOWED_ORIGINS', () => {
    vi.stubEnv('ALLOWED_ORIGINS', 'https://wallet.example.com,https://proxy.example.com:8443');
    const config = nextConfig(PHASE_DEVELOPMENT_SERVER);
    expect(config.experimental?.serverActions?.allowedOrigins).toEqual([
      'wallet.example.com',
      'proxy.example.com:8443',
    ]);
  });

  it('WEB-09 no anuncia Next.js en los headers ni genera archivos para agentes de IA', () => {
    const config = nextConfig(PHASE_DEVELOPMENT_SERVER);
    expect(config.poweredByHeader).toBe(false);
    expect(config.agentRules).toBe(false);
  });

  it('WEB-08 no registra los argumentos de las Server Actions (contraseñas y códigos)', () => {
    const config = nextConfig(PHASE_DEVELOPMENT_SERVER);
    expect(config.logging).toMatchObject({ serverFunctions: false });
  });

  it('WEB-06 next.config falla al arrancar si el entorno es inválido', () => {
    vi.stubEnv('ALLOWED_ORIGINS', 'no-es-un-origen');
    expect(() => nextConfig(PHASE_DEVELOPMENT_SERVER)).toThrow(/ALLOWED_ORIGINS/);
  });

  it('WEB-09 next start en producción exige API_BASE_URL; el build no la necesita', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('API_BASE_URL', undefined);
    expect(() => nextConfig(PHASE_PRODUCTION_SERVER)).toThrow(/API_BASE_URL/);
    expect(() => nextConfig(PHASE_PRODUCTION_BUILD)).not.toThrow();
  });
});
