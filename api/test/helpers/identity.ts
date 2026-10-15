import request from 'supertest';
import { expect } from 'vitest';
import type { TestApp } from './app.js';
import { expectToMatchContract } from './contract.js';
import { composeFullName } from '../../src/modules/identity/domain/full-name.js';
import { newRegistration, type Registration } from './factories.js';

/** Lo que se registró más el nombre completo que la API compone y devuelve. */
export type Person = Registration & { readonly fullName: string };

function withFullName(registration: Registration): Person {
  return { ...registration, fullName: composeFullName(registration) };
}

export interface VerifiedUser {
  readonly person: Person;
  readonly userId: string;
  readonly accessToken: string;
  readonly refreshToken: string;
}

/** Registra a una persona y devuelve el código que recibió por correo. */
export async function registerPerson(
  t: TestApp,
  overrides: Partial<Registration> = {},
): Promise<{ person: Person; code: string }> {
  const registration = newRegistration(overrides);
  const person = withFullName(registration);
  const res = await request(t.app).post('/auth/register').send(registration);
  expect(res.status).toBe(202);
  // El correo llega a la dirección normalizada (IDN-02).
  return { person, code: t.mailer.lastCode(person.email.trim().toLowerCase()) };
}

/** Registra y verifica a una persona: queda con sus dos cuentas y una sesión. */
export async function verifiedUser(
  t: TestApp,
  overrides: Partial<Registration> = {},
): Promise<VerifiedUser> {
  const { person, code } = await registerPerson(t, overrides);
  const res = await request(t.app)
    .post('/auth/verify-email')
    .send({ email: person.email.trim().toLowerCase(), code });
  expectToMatchContract(res, 'verifyEmail');
  expect(res.status).toBe(200);
  return {
    person,
    userId: res.body.user.id,
    accessToken: res.body.tokens.accessToken,
    refreshToken: res.body.tokens.refreshToken,
  };
}

/** Un código de 6 dígitos distinto del dado. */
export function wrongCode(code: string): string {
  return code === '000000' ? '000001' : '000000';
}
