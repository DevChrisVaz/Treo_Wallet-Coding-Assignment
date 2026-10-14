import { createHmac, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Clock } from '../../../shared/clock.js';
import type { Transaction } from '../../../shared/transaction.js';

export type CodePurpose = 'EMAIL_VERIFICATION' | 'TRANSFER_CONFIRMATION';

export interface CodePolicy {
  readonly ttlMs: number;
  readonly maxAttempts: number;
  readonly maxResends: number;
}

/** Código de verificación de correo: 15 minutos, 3 intentos, 3 reenvíos (IDN-05). */
export const EMAIL_VERIFICATION_POLICY: CodePolicy = {
  ttlMs: 15 * 60_000,
  maxAttempts: 3,
  maxResends: 3,
};

export interface StoredCode {
  readonly id: string;
  readonly codeHash: string;
  readonly attempts: number;
  readonly resendCount: number;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
}

/** Persistencia de los desafíos (una fila por propósito y sujeto). */
export interface OneTimeCodeStore {
  findForUpdate(
    tx: Transaction,
    purpose: CodePurpose,
    subjectId: string,
  ): Promise<StoredCode | null>;
  insert(
    tx: Transaction,
    row: { id: string; purpose: CodePurpose; subjectId: string; codeHash: string; expiresAt: Date },
  ): Promise<void>;
  replace(
    tx: Transaction,
    id: string,
    values: { codeHash: string; expiresAt: Date; resendCount: number },
  ): Promise<void>;
  recordFailedAttempt(tx: Transaction, id: string): Promise<number>;
  consume(tx: Transaction, id: string, at: Date): Promise<void>;
}

export interface IssuedCode {
  readonly code: string;
  readonly expiresAt: Date;
  readonly resendsRemaining: number;
}

export type CodeVerification =
  | { readonly status: 'VALID' }
  | { readonly status: 'INVALID'; readonly attemptsRemaining: number; readonly exhausted: boolean }
  | { readonly status: 'EXPIRED' | 'UNUSABLE'; readonly attemptsRemaining: 0 };

/**
 * Códigos de un solo uso compartidos por la verificación de correo y la confirmación de
 * transferencias (IDN-05). El código es de 6 dígitos de un generador criptográfico, se guarda solo
 * como HMAC-SHA256 con un secreto del servidor y se compara en tiempo constante. Cada operación
 * corre dentro de la transacción de quien llama y bloquea la fila del desafío.
 */
export class OneTimeCodeService {
  constructor(
    private readonly store: OneTimeCodeStore,
    private readonly clock: Clock,
    private readonly secret: Buffer,
  ) {}

  /** Crea el desafío del sujeto (o lo reemplaza si ya existía, sin contar como reenvío). */
  async issue(
    tx: Transaction,
    purpose: CodePurpose,
    subjectId: string,
    policy: CodePolicy,
  ): Promise<IssuedCode> {
    const code = this.generate();
    const expiresAt = new Date(this.clock.now().getTime() + policy.ttlMs);
    const codeHash = this.hmac(purpose, subjectId, code);
    const existing = await this.store.findForUpdate(tx, purpose, subjectId);
    if (existing) {
      await this.store.replace(tx, existing.id, { codeHash, expiresAt, resendCount: 0 });
    } else {
      await this.store.insert(tx, { id: randomUUID(), purpose, subjectId, codeHash, expiresAt });
    }
    return { code, expiresAt, resendsRemaining: policy.maxResends };
  }

  /**
   * Reenvío: invalida el código anterior y reinicia intentos y vigencia. Devuelve `null` si ya se
   * alcanzó el máximo de reenvíos.
   */
  async reissue(
    tx: Transaction,
    purpose: CodePurpose,
    subjectId: string,
    policy: CodePolicy,
  ): Promise<IssuedCode | null> {
    const existing = await this.store.findForUpdate(tx, purpose, subjectId);
    if (!existing) return this.issue(tx, purpose, subjectId, policy);
    if (existing.resendCount >= policy.maxResends) return null;
    const code = this.generate();
    const expiresAt = new Date(this.clock.now().getTime() + policy.ttlMs);
    const resendCount = existing.resendCount + 1;
    await this.store.replace(tx, existing.id, {
      codeHash: this.hmac(purpose, subjectId, code),
      expiresAt,
      resendCount,
    });
    return { code, expiresAt, resendsRemaining: policy.maxResends - resendCount };
  }

  /**
   * Valida un código. Un fallo incrementa `attempts` en la transacción de quien llama, que debe
   * confirmarla aunque la petición termine en error, para que el contador avance.
   */
  async verify(
    tx: Transaction,
    purpose: CodePurpose,
    subjectId: string,
    code: string,
    policy: CodePolicy,
  ): Promise<CodeVerification> {
    const stored = await this.store.findForUpdate(tx, purpose, subjectId);
    if (!stored || stored.consumedAt !== null || stored.attempts >= policy.maxAttempts) {
      return { status: 'UNUSABLE', attemptsRemaining: 0 };
    }
    if (stored.expiresAt.getTime() <= this.clock.now().getTime()) {
      return { status: 'EXPIRED', attemptsRemaining: 0 };
    }
    const expected = Buffer.from(stored.codeHash, 'hex');
    const actual = Buffer.from(this.hmac(purpose, subjectId, code), 'hex');
    if (expected.length === actual.length && timingSafeEqual(expected, actual)) {
      await this.store.consume(tx, stored.id, this.clock.now());
      return { status: 'VALID' };
    }
    const attempts = await this.store.recordFailedAttempt(tx, stored.id);
    const attemptsRemaining = Math.max(policy.maxAttempts - attempts, 0);
    return { status: 'INVALID', attemptsRemaining, exhausted: attemptsRemaining === 0 };
  }

  private generate(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hmac(purpose: CodePurpose, subjectId: string, code: string): string {
    return createHmac('sha256', this.secret)
      .update(`${purpose}:${subjectId}:${code}`)
      .digest('hex');
  }
}
