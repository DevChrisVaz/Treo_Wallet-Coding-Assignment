import { isIP } from 'node:net';
import * as z from 'zod';
import { Money } from '../../shared/money.js';

export const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface AppConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly host: string;
  readonly port: number;
  /** Conexión con el rol de ejecución (`wallet_app`). */
  readonly databaseUrl: string;
  /** Conexión con el rol dueño del esquema (`wallet_migrator`); solo para migraciones y seed. */
  readonly migrationDatabaseUrl: string | undefined;
  readonly jwtSecret: Buffer;
  readonly jwtIssuer: string;
  readonly jwtAudience: string;
  readonly otpHmacSecret: Buffer;
  readonly clabe: { readonly bankCode: string; readonly plazaCode: string };
  readonly smtp: {
    readonly host: string;
    readonly port: number;
    readonly from: string;
    /** Credenciales SMTP (SES en AWS); en local, Mailpit no las pide. */
    readonly user: string | undefined;
    readonly password: string | undefined;
  };
  /** Valores para `trust proxy` de Express: palabras clave, IPs o subredes (PLT-07). */
  readonly trustedProxies: readonly string[];
  readonly logLevel: LogLevel;
  readonly transfers: {
    /** Límite diario de transferencias a terceros por usuario (TRF-11). */
    readonly dailyLimit: Money;
    /** Montos mayores a éste piden OTP (TRF-14). */
    readonly otpThreshold: Money;
    readonly otpTtlSeconds: number;
    readonly otpMaxAttempts: number;
    readonly otpMaxResends: number;
  };
  /** Firma HMAC de los cursores de paginación (HIS-05). */
  readonly cursorSigningSecret: Buffer;
  /** Ejecutor de transferencias programadas (TRF-30, D6). */
  readonly scheduler: {
    /** `false` en pruebas, que llaman a `runOnce()` directamente. */
    readonly enabled: boolean;
    /** Cada cuánto corre una pasada (una a la vez por instancia). */
    readonly intervalMs: number;
    /** Candidatas por lote; si el lote viene lleno, la pasada pide el siguiente. */
    readonly batchSize: number;
  };
}

/** Error de arranque: nombra las variables inválidas, nunca sus valores. */
export class ConfigError extends Error {
  constructor(
    readonly variables: string[],
    details: string[],
  ) {
    super(`Configuración inválida: ${details.join('; ')}`);
    this.name = 'ConfigError';
  }
}

const MIN_SECRET_BYTES = 32;
const BASE64 = /^[A-Za-z0-9+/_-]+={0,2}$/;
const PROXY_KEYWORDS = new Set(['loopback', 'linklocal', 'uniquelocal']);

function required(message: string) {
  return z.string({ error: message }).trim().min(1, { error: message });
}

const postgresUrl = (name: string) =>
  required(`${name} es obligatoria`).refine(
    (value) => {
      try {
        return ['postgres:', 'postgresql:'].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    { error: `${name} debe ser una URL postgres://` },
  );

const secret = (name: string) =>
  required(`${name} es obligatorio`)
    .refine((value) => BASE64.test(value), { error: `${name} debe estar codificado en base64` })
    // El decodificador base64 de Node acepta también el alfabeto base64url.
    .transform((value) => Buffer.from(value, 'base64'))
    .refine((bytes) => bytes.length >= MIN_SECRET_BYTES, {
      error: `${name} debe tener al menos 256 bits (32 bytes decodificados)`,
    });

const threeDigits = (name: string) =>
  required(`${name} es obligatorio`).regex(/^[0-9]{3}$/, { error: `${name} debe tener 3 dígitos` });

const port = (name: string, fallback: number) =>
  z.coerce
    .number({ error: `${name} debe ser un número de puerto` })
    .int({ error: `${name} debe ser un número de puerto` })
    .min(1, { error: `${name} debe estar entre 1 y 65535` })
    .max(65535, { error: `${name} debe estar entre 1 y 65535` })
    .default(fallback);

/** Monto de configuración con el mismo formato que la entrada de la API. */
const moneyValue = (name: string, fallback: string) =>
  z
    .string()
    .default(fallback)
    .refine(
      (value) => {
        try {
          Money.parse(value);
          return true;
        } catch {
          return false;
        }
      },
      { error: `${name} debe ser un monto positivo con 0 a 2 decimales` },
    )
    .transform((value) => Money.parse(value));

/** Entero acotado; la base limita intentos y reenvíos a 3. */
const boundedInt = (name: string, fallback: number, min: number, max: number) =>
  z.coerce
    .number({ error: `${name} debe ser un entero` })
    .int({ error: `${name} debe ser un entero` })
    .min(min, { error: `${name} debe estar entre ${min} y ${max}` })
    .max(max, { error: `${name} debe estar entre ${min} y ${max}` })
    .default(fallback);

function isProxy(value: string): boolean {
  if (PROXY_KEYWORDS.has(value)) return true;
  const [address, prefix, ...rest] = value.split('/');
  if (rest.length > 0 || !address) return false;
  const version = isIP(address);
  if (version === 0) return false;
  if (prefix === undefined) return true;
  const bits = Number(prefix);
  return /^[0-9]{1,3}$/.test(prefix) && bits <= (version === 4 ? 32 : 128);
}

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'], {
      error: 'NODE_ENV debe ser development, test o production',
    })
    .default('development'),
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  PORT: port('PORT', 4000),
  DATABASE_URL: postgresUrl('DATABASE_URL'),
  MIGRATION_DATABASE_URL: postgresUrl('MIGRATION_DATABASE_URL').optional(),
  JWT_SECRET: secret('JWT_SECRET'),
  JWT_ISSUER: z.string().trim().min(1).default('wallet-api'),
  JWT_AUDIENCE: z.string().trim().min(1).default('wallet-clients'),
  OTP_HMAC_SECRET: secret('OTP_HMAC_SECRET'),
  CLABE_BANK_CODE: threeDigits('CLABE_BANK_CODE'),
  CLABE_PLAZA_CODE: threeDigits('CLABE_PLAZA_CODE'),
  SMTP_HOST: required('SMTP_HOST es obligatorio'),
  SMTP_PORT: port('SMTP_PORT', 1025),
  SMTP_FROM: required('SMTP_FROM es obligatorio'),
  SMTP_USER: z.string().trim().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  TRUSTED_PROXIES: z
    .string()
    .default('loopback')
    .transform((value) =>
      value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0),
    )
    .refine((items) => items.every(isProxy), {
      error: 'TRUSTED_PROXIES admite loopback, linklocal, uniquelocal, IPs o subredes CIDR',
    }),
  DAILY_TRANSFER_LIMIT: moneyValue('DAILY_TRANSFER_LIMIT', '50000.00'),
  OTP_THRESHOLD: moneyValue('OTP_THRESHOLD', '10000.00'),
  OTP_TTL_SECONDS: boundedInt('OTP_TTL_SECONDS', 300, 30, 3600),
  OTP_MAX_ATTEMPTS: boundedInt('OTP_MAX_ATTEMPTS', 3, 1, 3),
  OTP_MAX_RESENDS: boundedInt('OTP_MAX_RESENDS', 3, 0, 3),
  CURSOR_SIGNING_SECRET: secret('CURSOR_SIGNING_SECRET'),
  SCHEDULER_ENABLED: z
    .enum(['true', 'false'], { error: 'SCHEDULER_ENABLED debe ser true o false' })
    .default('true')
    .transform((value) => value === 'true'),
  SCHEDULER_INTERVAL_MS: boundedInt('SCHEDULER_INTERVAL_MS', 60_000, 1_000, 3_600_000),
  SCHEDULER_BATCH_SIZE: boundedInt('SCHEDULER_BATCH_SIZE', 100, 1, 1_000),
  LOG_LEVEL: z
    .enum(LOG_LEVELS, { error: `LOG_LEVEL debe ser uno de ${LOG_LEVELS.join(', ')}` })
    .default('info'),
});

/**
 * Valida la configuración del proceso (PLT-08). Lanza `ConfigError` con los nombres de las variables
 * inválidas; los mensajes se escriben aquí y nunca incluyen el valor recibido.
 */
export function loadConfig(env: Record<string, string | undefined>): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const variables = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0])))];
    const details = parsed.error.issues.map((issue) => {
      const name = String(issue.path[0]);
      return issue.message.startsWith(name) ? issue.message : `${name} es inválida`;
    });
    throw new ConfigError(variables, [...new Set(details)]);
  }
  const e = parsed.data;
  return {
    nodeEnv: e.NODE_ENV,
    host: e.HOST,
    port: e.PORT,
    databaseUrl: e.DATABASE_URL,
    migrationDatabaseUrl: e.MIGRATION_DATABASE_URL,
    jwtSecret: e.JWT_SECRET,
    jwtIssuer: e.JWT_ISSUER,
    jwtAudience: e.JWT_AUDIENCE,
    otpHmacSecret: e.OTP_HMAC_SECRET,
    clabe: { bankCode: e.CLABE_BANK_CODE, plazaCode: e.CLABE_PLAZA_CODE },
    smtp: {
      host: e.SMTP_HOST,
      port: e.SMTP_PORT,
      from: e.SMTP_FROM,
      user: e.SMTP_USER,
      password: e.SMTP_PASSWORD,
    },
    trustedProxies: e.TRUSTED_PROXIES,
    logLevel: e.LOG_LEVEL,
    transfers: {
      dailyLimit: e.DAILY_TRANSFER_LIMIT,
      otpThreshold: e.OTP_THRESHOLD,
      otpTtlSeconds: e.OTP_TTL_SECONDS,
      otpMaxAttempts: e.OTP_MAX_ATTEMPTS,
      otpMaxResends: e.OTP_MAX_RESENDS,
    },
    cursorSigningSecret: e.CURSOR_SIGNING_SECRET,
    scheduler: {
      enabled: e.SCHEDULER_ENABLED,
      intervalMs: e.SCHEDULER_INTERVAL_MS,
      batchSize: e.SCHEDULER_BATCH_SIZE,
    },
  };
}
