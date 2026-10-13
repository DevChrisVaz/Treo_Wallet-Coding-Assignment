import type { Express } from 'express';
import type { DataSource } from 'typeorm';
import type { AuditWriter } from './modules/audit/application/audit-writer.js';
import { PgAuditWriter } from './modules/audit/infrastructure/pg-audit-writer.js';
import { OneTimeCodeService } from './modules/identity/application/one-time-codes.js';
import type { PasswordHasher } from './modules/identity/application/ports.js';
import { GetCurrentUser } from './modules/identity/application/get-current-user.js';
import { Login } from './modules/identity/application/login.js';
import { Logout } from './modules/identity/application/logout.js';
import { RefreshSession } from './modules/identity/application/refresh-session.js';
import { RegisterUser } from './modules/identity/application/register-user.js';
import { ResendVerification } from './modules/identity/application/resend-verification.js';
import { SessionService } from './modules/identity/application/sessions.js';
import { VerifyEmail } from './modules/identity/application/verify-email.js';
import { JoseAccessTokens } from './modules/identity/infrastructure/jose-access-tokens.js';
import { PgRefreshTokenStore } from './modules/identity/infrastructure/pg-refresh-token-store.js';
import { OpenDefaultAccounts } from './modules/accounts/application/open-default-accounts.js';
import { PgAccountRepository } from './modules/accounts/infrastructure/pg-account-repository.js';
import { Argon2PasswordHasher } from './modules/identity/infrastructure/argon2-password-hasher.js';
import { identityRoutes } from './modules/identity/infrastructure/http/routes.js';
import { PgOneTimeCodeStore } from './modules/identity/infrastructure/pg-one-time-code-store.js';
import { PgUserRepository } from './modules/identity/infrastructure/pg-user-repository.js';
import type { UserRepository } from './modules/identity/application/users.js';
import { systemClock } from './platform/clock/system-clock.js';
import type { AppConfig } from './platform/config/config.js';
import { createHttpApp } from './platform/http/app.js';
import {
  assertPublicRoutesAllowed,
  authenticate,
  type AccessTokenVerifier,
} from './platform/http/auth.js';
import { docsRouter } from './platform/http/docs.js';
import { healthRouter } from './platform/http/health.js';
import { createLogger, type Logger } from './platform/logging/logger.js';
import type { Mailer } from './platform/mail/mailer.js';
import { SmtpMailer } from './platform/mail/smtp-mailer.js';
import { createAppDataSource } from './platform/persistence/data-sources.js';
import { PgErrorTranslator } from './platform/persistence/pg-errors.js';
import { registerLedgerTranslations } from './modules/transfers/infrastructure/error-translations.js';
import { FundAccount } from './modules/transfers/application/fund-account.js';
import { LedgerPoster } from './modules/transfers/application/ledger-poster.js';
import { PgAccountLocks } from './modules/transfers/infrastructure/pg-account-locks.js';
import { PgLedgerStore } from './modules/transfers/infrastructure/pg-ledger-store.js';
import { PgTransferStore } from './modules/transfers/infrastructure/pg-transfer-store.js';
import { TypeormTransactionRunner } from './platform/persistence/transaction.js';
import type { Clock } from './shared/clock.js';
import type { TransactionRunner } from './shared/transaction.js';

/** Adaptadores que las pruebas (o el seed) pueden sustituir al construir el contenedor. */
export interface ContainerOverrides {
  readonly dataSource: DataSource;
  readonly clock: Clock;
  readonly mailer: Mailer;
  readonly logger: Logger;
  readonly hasher: PasswordHasher;
  readonly audit: AuditWriter;
  /** Para pruebas de concurrencia que necesitan sincronizar dos transacciones. */
  readonly users: UserRepository;
}

export interface Container {
  readonly config: AppConfig;
  readonly dataSource: DataSource;
  readonly clock: Clock;
  readonly logger: Logger;
  readonly mailer: Mailer;
  readonly transactions: TransactionRunner;
  readonly audit: AuditWriter;
  readonly errors: PgErrorTranslator;
  readonly accessTokens: AccessTokenVerifier;
  readonly identity: {
    readonly registerUser: RegisterUser;
    readonly verifyEmail: VerifyEmail;
    readonly resendVerification: ResendVerification;
    readonly refreshSession: RefreshSession;
    readonly login: Login;
    readonly logout: Logout;
    readonly getCurrentUser: GetCurrentUser;
  };
  readonly ledger: {
    readonly fundAccount: FundAccount;
  };
}

/**
 * Raíz de composición (PLT-18). Construye los adaptadores de infraestructura y los inyecta a mano
 * en los casos de uso de cada módulo; no hay contenedor de DI. El DataSource se entrega ya
 * inicializado (o lo inicializa quien llama a `main`).
 */
export async function createContainer(
  config: AppConfig,
  overrides: Partial<ContainerOverrides> = {},
): Promise<Container> {
  const logger = overrides.logger ?? createLogger({ level: config.logLevel });
  const clock = overrides.clock ?? systemClock;
  const dataSource = overrides.dataSource ?? createAppDataSource(config.databaseUrl);
  const mailer = overrides.mailer ?? new SmtpMailer(config.smtp);
  const hasher = overrides.hasher ?? (await Argon2PasswordHasher.create());
  const audit = overrides.audit ?? new PgAuditWriter(dataSource, clock);
  const transactions = new TypeormTransactionRunner(dataSource);
  const errors = new PgErrorTranslator(logger);
  registerLedgerTranslations(errors);

  const users = overrides.users ?? new PgUserRepository(dataSource);
  const transferStore = new PgTransferStore();
  const accountLocks = new PgAccountLocks(dataSource);
  const poster = new LedgerPoster(new PgLedgerStore());
  const codes = new OneTimeCodeService(new PgOneTimeCodeStore(), clock, config.otpHmacSecret);
  const accounts = new PgAccountRepository(dataSource);
  const openAccounts = new OpenDefaultAccounts({ accounts, clabe: config.clabe, clock });
  const refreshTokens = new PgRefreshTokenStore();
  const sessions = new SessionService(refreshTokens, clock);
  const accessTokens = new JoseAccessTokens({
    secret: config.jwtSecret,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });

  return {
    config,
    dataSource,
    clock,
    logger,
    mailer,
    transactions,
    audit,
    errors,
    accessTokens,
    identity: {
      registerUser: new RegisterUser({
        transactions,
        users,
        codes,
        hasher,
        audit,
        mailer,
        logger,
        clock,
      }),
      verifyEmail: new VerifyEmail({
        transactions,
        users,
        codes,
        openAccounts,
        sessions,
        accessTokens,
        audit,
        clock,
      }),
      resendVerification: new ResendVerification({
        transactions,
        users,
        codes,
        audit,
        mailer,
        logger,
      }),
      refreshSession: new RefreshSession({
        transactions,
        store: refreshTokens,
        sessions,
        accessTokens,
        audit,
        clock,
      }),
      login: new Login({ transactions, users, hasher, sessions, accessTokens, audit, clock }),
      logout: new Logout({ transactions, store: refreshTokens, audit, clock }),
      getCurrentUser: new GetCurrentUser(users),
    },
    ledger: {
      fundAccount: new FundAccount({
        transactions,
        transfers: transferStore,
        locks: accountLocks,
        poster,
        audit,
        clock,
      }),
    },
  };
}

/** La aplicación HTTP: plataforma + routers de los módulos. */
export function createApp(container: Container): Express {
  const authenticateRequest = authenticate(container.accessTokens, container.clock);
  const tables = [identityRoutes(container.identity, authenticateRequest, container.clock)];
  for (const table of tables) assertPublicRoutesAllowed(table.table);
  return createHttpApp({
    trustedProxies: container.config.trustedProxies,
    logger: container.logger,
    translateError: container.errors.translate,
    routers: [
      healthRouter(),
      docsRouter({ nodeEnv: container.config.nodeEnv }),
      ...tables.map((table) => table.router),
    ],
  });
}
