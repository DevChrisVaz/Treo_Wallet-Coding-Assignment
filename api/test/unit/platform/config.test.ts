import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../../src/platform/config/config.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Variables válidas mínimas; cada prueba altera solo la que le interesa. */
const SECRET_A = Buffer.alloc(32, 7).toString('base64');
const SECRET_B = Buffer.alloc(32, 9).toString('base64url');
const validEnv = {
  DATABASE_URL: 'postgres://wallet_app:app-secret-pass@localhost:5433/wallet',
  JWT_SECRET: SECRET_A,
  OTP_HMAC_SECRET: SECRET_B,
  CLABE_BANK_CODE: '999',
  CLABE_PLAZA_CODE: '180',
  SMTP_HOST: 'localhost',
  SMTP_FROM: 'Billetera <no-reply@wallet.local>',
};

function errorOf(env: Record<string, string | undefined>): ConfigError {
  try {
    loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) return error;
    throw error;
  }
  throw new Error('loadConfig no lanzó ConfigError');
}

describe('PLT-08 configuración validada al arrancar', () => {
  it('PLT-08 .env.example produce una configuración válida', () => {
    const env = parseEnv(readFileSync(resolve(root, '.env.example'), 'utf8'));
    expect(() => loadConfig(env)).not.toThrow();
  });

  it('PLT-08 acepta una configuración válida y aplica los valores por defecto', () => {
    const config = loadConfig(validEnv);
    expect(config.nodeEnv).toBe('development');
    expect(config.host).toBe('0.0.0.0');
    expect(config.port).toBe(4000);
    expect(config.jwtSecret).toHaveLength(32);
    expect(config.otpHmacSecret).toHaveLength(32);
    expect(config.clabe).toEqual({ bankCode: '999', plazaCode: '180' });
    expect(config.smtp).toEqual({
      host: 'localhost',
      port: 1025,
      from: 'Billetera <no-reply@wallet.local>',
    });
    expect(config.trustedProxies).toEqual(['loopback']);
    expect(config.logLevel).toBe('info');
  });

  it('PLT-08 rechaza un secreto de firma de menos de 256 bits sin mostrar su valor', () => {
    const shortSecret = Buffer.alloc(31, 1).toString('base64');
    const error = errorOf({ ...validEnv, JWT_SECRET: shortSecret });
    expect(error.variables).toEqual(['JWT_SECRET']);
    expect(error.message).toContain('JWT_SECRET');
    expect(error.message).not.toContain(shortSecret);
  });

  it('PLT-08 rechaza un secreto de OTP que no es base64', () => {
    const error = errorOf({
      ...validEnv,
      OTP_HMAC_SECRET: 'esto no es base64 pero es largo!!!!!!!!',
    });
    expect(error.variables).toEqual(['OTP_HMAC_SECRET']);
  });

  it('PLT-08 rechaza la falta de la cadena de conexión a la base de datos', () => {
    const { DATABASE_URL: _omitted, ...env } = validEnv;
    const error = errorOf(env);
    expect(error.variables).toEqual(['DATABASE_URL']);
  });

  it('PLT-08 rechaza una cadena de conexión que no es de PostgreSQL sin mostrar la contraseña', () => {
    const url = 'mysql://root:super-secret-password@localhost/wallet';
    const error = errorOf({ ...validEnv, DATABASE_URL: url });
    expect(error.variables).toEqual(['DATABASE_URL']);
    expect(error.message).not.toContain('super-secret-password');
  });

  it('PLT-08 exige códigos de banco y plaza de exactamente 3 dígitos', () => {
    const error = errorOf({ ...validEnv, CLABE_BANK_CODE: '99', CLABE_PLAZA_CODE: '18a' });
    expect(error.variables.sort()).toEqual(['CLABE_BANK_CODE', 'CLABE_PLAZA_CODE']);
  });

  it('PLT-08 valida el puerto, el entorno, el nivel de log y los proxies de confianza', () => {
    const error = errorOf({
      ...validEnv,
      PORT: '70000',
      NODE_ENV: 'staging',
      LOG_LEVEL: 'verbose',
      TRUSTED_PROXIES: 'loopback, 10.0.0.0/8, no-es-ip',
    });
    expect(error.variables.sort()).toEqual(['LOG_LEVEL', 'NODE_ENV', 'PORT', 'TRUSTED_PROXIES']);
  });

  it('PLT-08 acepta proxies de confianza como palabras clave, IPs y subredes', () => {
    const config = loadConfig({ ...validEnv, TRUSTED_PROXIES: 'loopback, 10.0.0.0/16,::1' });
    expect(config.trustedProxies).toEqual(['loopback', '10.0.0.0/16', '::1']);
  });

  it('PLT-08 el proceso termina con error antes de aceptar peticiones y sin revelar el valor', () => {
    const shortSecret = Buffer.alloc(16, 3).toString('base64');
    const result = spawnSync(process.execPath, ['--import', 'tsx', resolve(root, 'src/main.ts')], {
      cwd: root,
      encoding: 'utf8',
      env: { PATH: process.env.PATH, ...validEnv, JWT_SECRET: shortSecret },
      timeout: 20_000,
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('JWT_SECRET');
    expect(result.stderr).not.toContain(shortSecret);
  });
});
