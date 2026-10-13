import { describe, expect, it } from 'vitest';
import { Argon2PasswordHasher } from '../../../src/modules/identity/infrastructure/argon2-password-hasher.js';

describe('IDN-04 almacenamiento seguro de contraseñas', () => {
  it('IDN-04 produce un hash argon2id con los parámetros de OWASP y sal aleatoria', async () => {
    const hasher = await Argon2PasswordHasher.create();
    const first = await hasher.hash('contraseña larga 123');
    const second = await hasher.hash('contraseña larga 123');
    expect(first).toMatch(/^\$argon2id\$v=19\$m=19456,p=1,t=2\$/);
    expect(first).not.toContain('contraseña');
    expect(first).not.toBe(second);
  });

  it('IDN-04 verifica la contraseña correcta y rechaza una incorrecta', async () => {
    const hasher = await Argon2PasswordHasher.create();
    const hash = await hasher.hash('contraseña larga 123');
    expect(await hasher.verify(hash, 'contraseña larga 123')).toBe(true);
    expect(await hasher.verify(hash, 'contraseña larga 124')).toBe(false);
  });

  it('IDN-08 el hash ficticio se calcula al crear el hasher y su verificación siempre falla', async () => {
    const hasher = await Argon2PasswordHasher.create();
    expect(await hasher.verifyDummy('cualquier cosa')).toBe(false);
  });

  it('IDN-08 verificar contra el hash ficticio cuesta lo mismo que contra uno real', async () => {
    const hasher = await Argon2PasswordHasher.create();
    const hash = await hasher.hash('contraseña larga 123');
    const time = async (fn: () => Promise<unknown>) => {
      const start = process.hrtime.bigint();
      await fn();
      return Number(process.hrtime.bigint() - start) / 1e6;
    };
    // Calentamiento para no medir la primera llamada al módulo nativo.
    await hasher.verify(hash, 'x');
    // Suma de tres mediciones de cada caso, para amortiguar el ruido del equipo de CI.
    let real = 0;
    let dummy = 0;
    for (let i = 0; i < 3; i += 1) {
      real += await time(() => hasher.verify(hash, 'otra contraseña'));
      dummy += await time(() => hasher.verifyDummy('otra contraseña'));
    }
    expect(dummy).toBeGreaterThan(real * 0.4);
    expect(dummy).toBeLessThan(real * 2.5);
  });
});
