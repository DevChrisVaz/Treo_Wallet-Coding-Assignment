import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandShell } from '@/components/layout/BrandShell';
import { sessionStore } from '@/lib/server/session-store';
import { resetRequest } from '@/test/support/next-headers';
import { SESSION_ID } from '@/test/support/session';
import LoginPage from './login/page';
import RegisterPage from './register/page';
import VerifyEmailPage from './verify-email/page';

vi.mock('next/headers', () => import('@/test/support/next-headers'));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

type Shell = ReactElement<{ title: string }>;
const props = (searchParams: Record<string, string> = {}) =>
  ({ searchParams: Promise.resolve(searchParams), params: Promise.resolve({}) }) as never;

beforeEach(async () => {
  await sessionStore().delete(SESSION_ID);
  resetRequest();
});

describe('pantallas públicas de marca', () => {
  it('WEB-31 el inicio de sesión va sobre la superficie de marca con el título "Inicia sesión"', async () => {
    const page = (await LoginPage(props())) as Shell;
    expect(page.type).toBe(BrandShell);
    expect(page.props.title).toBe('Inicia sesión');
  });

  it('WEB-31 el registro va sobre la superficie de marca con el título "Crea tu cuenta"', () => {
    const page = RegisterPage() as Shell;
    expect(page.type).toBe(BrandShell);
    expect(page.props.title).toBe('Crea tu cuenta');
  });

  it('WEB-31 la verificación va sobre la superficie de marca con el título "Verifica tu correo"', async () => {
    const page = (await VerifyEmailPage(
      props({ email: 'ana@example.com', registered: '1' }),
    )) as Shell;
    expect(page.type).toBe(BrandShell);
    expect(page.props.title).toBe('Verifica tu correo');
  });
});
