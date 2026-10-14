import type { Account, AccountsOverview, Beneficiary, User } from '@devchrisvaz/wallet-contract';

export const principal: Account = {
  id: '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a51',
  name: 'Principal',
  clabe: '646180157000009719',
  balance: '25000.00',
  currency: 'MXN',
  createdAt: '2026-09-30T15:00:00Z',
};

export const ahorro: Account = {
  id: '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a52',
  name: 'Ahorro',
  clabe: '646180157000001234',
  balance: '10000.00',
  currency: 'MXN',
  createdAt: '2026-09-30T15:00:00Z',
};

export function overview(
  accounts: Account[] = [principal, ahorro],
  used = '18500.00',
  remaining = '31500.00',
): AccountsOverview {
  return {
    accounts,
    dailyLimit: {
      limit: '50000.00',
      used,
      remaining,
      resetsAt: '2026-10-14T06:00:00Z',
      timeZone: 'America/Mexico_City',
    },
  };
}

export const luis: Beneficiary = {
  id: '5d1e7c3a-9b2f-4a6e-8c0d-1e2f3a4b5c61',
  name: 'Luis Pérez',
  alias: 'Luis',
  clabe: '646180157000005678',
  createdAt: '2026-10-01T15:00:00Z',
};

export const mama: Beneficiary = {
  id: '5d1e7c3a-9b2f-4a6e-8c0d-1e2f3a4b5c62',
  name: 'María Gómez',
  alias: 'Mamá',
  clabe: '646180157000004321',
  createdAt: '2026-10-01T15:00:00Z',
};

/** Respuesta de `GET /me` (el saludo y el menú de la cuenta). */
export const me: User = {
  id: '6f1c2a8e-1d2b-4c3d-9e4f-5a6b7c8d9e0f',
  email: 'ana@example.com',
  fullName: 'Ana Gómez Castillo',
  phoneMasked: '+52******5678',
  curpMasked: 'GOCA**************',
  rfcMasked: 'GOCA*********',
  emailVerifiedAt: '2026-10-01T15:00:00Z',
  createdAt: '2026-10-01T14:55:00Z',
};
