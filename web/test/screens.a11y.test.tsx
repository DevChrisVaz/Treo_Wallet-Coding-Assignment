import { screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AccountsOverviewScreen } from '@/components/accounts/AccountsOverviewScreen';
import { MovementsScreen } from '@/components/accounts/MovementsScreen';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { VerifyEmailForm } from '@/components/auth/VerifyEmailForm';
import { BeneficiariesScreen } from '@/components/beneficiaries/BeneficiariesScreen';
import { NewBeneficiaryForm } from '@/components/beneficiaries/NewBeneficiaryForm';
import { AppFrame } from '@/components/layout/AppFrame';
import { BrandShell } from '@/components/layout/BrandShell';
import { TransferDetailScreen } from '@/components/transfers/TransferDetailScreen';
import { TransferFlow } from '@/components/transfers/TransferFlow';
import { bffGet } from '@/lib/client/bff';
import { BENEFICIARY, OVERVIEW, PRINCIPAL, movement, transfer } from '@/test/fixtures';
import { setLocation } from '@/test/support/next-navigation';
import { renderWithClient } from '@/test/support/render';

vi.mock('@/app/actions/auth', () => ({
  logout: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
}));
vi.mock('@/app/actions/beneficiaries', () => ({ createBeneficiary: vi.fn() }));
vi.mock('@/app/actions/transfers', () => ({
  createTransfer: vi.fn(),
  confirmTransfer: vi.fn(),
  resendTransferOtp: vi.fn(),
}));
vi.mock('@/lib/client/bff', () => ({ bffGet: vi.fn() }));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

const USER = { name: 'Ana Gómez Castillo', email: 'ana@example.com' };
/**
 * jsdom no aplica `display: none`: la navegación lateral y las pestañas, y los dos encabezados (el
 * de la app y la barra superior), están a la vez en el DOM. En el navegador lo cubre e2e/a11y.spec.ts.
 */
const IN_JSDOM = {
  rules: {
    'landmark-unique': { enabled: false },
    'landmark-no-duplicate-banner': { enabled: false },
  },
};

beforeEach(() => {
  vi.mocked(bffGet).mockReset();
  vi.mocked(bffGet).mockImplementation(async (path: string) => {
    if (path === 'accounts') return OVERVIEW;
    if (path === 'beneficiaries') return { items: [BENEFICIARY] };
    if (path.endsWith('/movements')) return { items: [movement()], nextCursor: null };
    if (path.startsWith('transfers/')) return transfer();
    throw new Error(`Lectura inesperada: ${path}`);
  });
});

const SIGNED_IN: [string, string, ReactElement, string][] = [
  ['Inicio', '/', <AccountsOverviewScreen key="home" />, 'Últimos movimientos'],
  [
    'Movimientos',
    `/accounts/${PRINCIPAL.id}/movements`,
    <MovementsScreen key="movements" accountId={PRINCIPAL.id} />,
    'Filtros',
  ],
  [
    'Beneficiarios',
    '/beneficiaries',
    <BeneficiariesScreen key="beneficiaries" />,
    'Luis Pérez Ramírez',
  ],
  [
    'Agregar beneficiario',
    '/beneficiaries/new',
    <NewBeneficiaryForm key="new" />,
    'Nombre del titular',
  ],
  ['Transferir', '/transfers/new', <TransferFlow key="flow" />, 'Tus cuentas'],
  [
    'Transferencia',
    `/transfers/${transfer().id}`,
    <TransferDetailScreen key="detail" transferId={transfer().id} />,
    'Completada',
  ],
];

describe('accesibilidad de cada pantalla en su estructura', () => {
  it.each(SIGNED_IN)(
    'WEB-23 %s dentro de la estructura de la app no tiene problemas de accesibilidad',
    async (_name, path, ui, ready) => {
      setLocation(path);
      const { container } = renderWithClient(<AppFrame user={USER}>{ui}</AppFrame>);
      await screen.findAllByText(ready);
      expect(await axe(container, IN_JSDOM)).toHaveNoViolations();
    },
  );

  it.each([
    ['inicio de sesión', 'Inicia sesión', <LoginForm key="login" />],
    ['registro', 'Crea tu cuenta', <RegisterForm key="register" />],
    [
      'verificación',
      'Verifica tu correo',
      <VerifyEmailForm key="verify" email="ana@example.com" registered />,
    ],
  ] as const)(
    'WEB-23 WEB-31 el %s sobre la superficie de marca no tiene problemas de accesibilidad',
    async (_name, title, form) => {
      const { container } = renderWithClient(<BrandShell title={title}>{form}</BrandShell>);
      expect(await axe(container)).toHaveNoViolations();
    },
  );
});
