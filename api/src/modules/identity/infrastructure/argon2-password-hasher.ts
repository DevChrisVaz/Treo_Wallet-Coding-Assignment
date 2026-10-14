import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type { PasswordHasher } from '../application/ports.js';

/** Parámetros mínimos recomendados por OWASP para argon2id: 19 MiB, 2 iteraciones, 1 hilo. */
const OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

/** argon2id con sal aleatoria por hash (IDN-04). La contraseña nunca se guarda ni se registra. */
export class Argon2PasswordHasher implements PasswordHasher {
  private constructor(private readonly dummyHash: string) {}

  /** Calcula el hash ficticio una vez, al arrancar, con una contraseña aleatoria descartada. */
  static async create(): Promise<Argon2PasswordHasher> {
    const dummy = await argon2.hash(randomBytes(32).toString('base64url'), OPTIONS);
    return new Argon2PasswordHasher(dummy);
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, OPTIONS);
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  async verifyDummy(password: string): Promise<false> {
    await argon2.verify(this.dummyHash, password);
    return false;
  }
}
