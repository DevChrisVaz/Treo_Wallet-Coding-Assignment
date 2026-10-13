import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Clock } from '../../../shared/clock.js';
import type { Transaction } from '../../../shared/transaction.js';

/** Cada refresh token vence a los 7 días; la familia (sesión), a los 30 días de iniciada (IDN-11). */
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60_000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60_000;

export interface RefreshTokenRow {
  readonly id: string;
  readonly userId: string;
  readonly familyId: string;
  readonly tokenHash: string;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly familyExpiresAt: Date;
}

/** Persistencia de refresh tokens: solo hashes, revocaciones como UPDATE. */
export interface RefreshTokenStore {
  insert(tx: Transaction, row: RefreshTokenRow): Promise<void>;
}

export interface IssuedRefreshToken {
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
  readonly familyId: string;
}

/** SHA-256 hexadecimal del token: con 32 bytes aleatorios no hace falta un hash lento ni secreto. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Sesiones de refresco (IDN-11): tokens opacos de 32 bytes aleatorios en base64url, guardados solo
 * como hash, agrupados en familias que nacen al iniciar sesión o verificar el correo.
 */
export class SessionService {
  constructor(
    private readonly store: RefreshTokenStore,
    private readonly clock: Clock,
  ) {}

  /** Crea la familia y su primer refresh token, dentro de la transacción de quien llama. */
  async start(tx: Transaction, userId: string): Promise<IssuedRefreshToken> {
    const now = this.clock.now();
    const familyExpiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    return this.issueInFamily(tx, userId, randomUUID(), now, familyExpiresAt);
  }

  protected async issueInFamily(
    tx: Transaction,
    userId: string,
    familyId: string,
    now: Date,
    familyExpiresAt: Date,
  ): Promise<IssuedRefreshToken & { readonly id: string }> {
    const refreshToken = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Math.min(now.getTime() + REFRESH_TOKEN_TTL_MS, familyExpiresAt.getTime()),
    );
    const id = randomUUID();
    await this.store.insert(tx, {
      id,
      userId,
      familyId,
      tokenHash: hashRefreshToken(refreshToken),
      issuedAt: now,
      expiresAt,
      familyExpiresAt,
    });
    return { id, refreshToken, refreshTokenExpiresAt: expiresAt, familyId };
  }
}
