import type { Express } from 'express';
import {
  createApp,
  createContainer,
  type Container,
  type ContainerOverrides,
} from '../../src/composition.js';
import type { AppConfig } from '../../src/platform/config/config.js';
import { Money } from '../../src/shared/money.js';
import { testDb } from './env.js';
import { FakeClock } from './fake-clock.js';
import type { IntegrationHarness } from './harness.js';
import { InMemoryMailer } from './in-memory-mailer.js';
import { captureLogger, type CapturedLogs } from './logs.js';

/** Configuración de pruebas: la misma forma que la de producción, con secretos fijos de prueba. */
export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    nodeEnv: 'test',
    host: '127.0.0.1',
    port: 0,
    databaseUrl: testDb.appUrl,
    migrationDatabaseUrl: testDb.migratorUrl,
    jwtSecret: Buffer.alloc(32, 11),
    jwtIssuer: 'wallet-api',
    jwtAudience: 'wallet-clients',
    otpHmacSecret: Buffer.alloc(32, 13),
    clabe: { bankCode: '999', plazaCode: '180' },
    smtp: {
      host: 'localhost',
      port: 1025,
      from: 'Billetera <no-reply@wallet.local>',
      user: undefined,
      password: undefined,
    },
    trustedProxies: ['loopback'],
    logLevel: 'debug',
    transfers: {
      dailyLimit: Money.parse('50000.00'),
      otpThreshold: Money.parse('10000.00'),
      otpTtlSeconds: 300,
      otpMaxAttempts: 3,
      otpMaxResends: 3,
    },
    cursorSigningSecret: Buffer.alloc(32, 17),
    scheduler: { batchSize: 100 },
    ...overrides,
  };
}

export interface TestApp {
  readonly app: Express;
  readonly container: Container;
  readonly clock: FakeClock;
  readonly mailer: InMemoryMailer;
  readonly logs: CapturedLogs;
}

/**
 * La API completa sobre la base de pruebas, con reloj, correo y logs controlados por la prueba.
 * Los adaptadores reales (PostgreSQL, argon2, JWT) son los de producción.
 */
export async function buildTestApp(
  harness: IntegrationHarness,
  options: {
    config?: Partial<AppConfig>;
    overrides?: Partial<ContainerOverrides>;
    now?: string;
  } = {},
): Promise<TestApp> {
  const clock = new FakeClock(options.now ?? '2026-10-13T18:00:00.000Z');
  const mailer = new InMemoryMailer();
  const logs = captureLogger();
  const container = await createContainer(testConfig(options.config), {
    dataSource: harness.app,
    clock,
    mailer,
    logger: logs.logger,
    ...options.overrides,
  });
  return { app: createApp(container), container, clock, mailer, logs };
}
