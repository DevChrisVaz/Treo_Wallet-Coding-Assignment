import { isValidElement, type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm, type LoginFormProps } from '@/components/auth/LoginForm';
import { sessionStore } from '@/lib/server/session-store';
import { resetRequest } from '@/test/support/next-headers';
import { SESSION_ID, sessionData } from '@/test/support/session';
import LoginPage from './page';

vi.mock('next/headers', () => import('@/test/support/next-headers'));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

async function loginFormProps(searchParams: Record<string, string>): Promise<LoginFormProps> {
  const page = (await LoginPage({
    searchParams: Promise.resolve(searchParams),
    params: Promise.resolve({}),
  } as never)) as ReactElement<{ children: unknown[] }>;
  const form = page.props.children.find(
    (child): child is ReactElement<LoginFormProps> =>
      isValidElement(child) && child.type === LoginForm,
  );
  if (!form) throw new Error('La página no muestra el formulario');
  return form.props;
}

beforeEach(async () => {
  await sessionStore().delete(SESSION_ID);
  resetRequest();
});

describe('página de inicio de sesión', () => {
  it('WEB-22 después de iniciar sesión vuelve a la pantalla que se intentaba abrir', async () => {
    const path = '/accounts/0b7d6f5e-4c3b-4a29-8187-6f5e4d3c2b1a/movements';
    expect(await loginFormProps({ next: path })).toMatchObject({ redirectTo: path });
  });

  it('WEB-22 si el regreso apunta a otro sitio, muestra el resumen de cuentas', async () => {
    expect(await loginFormProps({ next: 'https://evil.example.com' })).toMatchObject({
      redirectTo: '/',
    });
  });

  it('WEB-03 muestra el aviso de sesión expirada', async () => {
    expect(await loginFormProps({ reason: 'expired' })).toMatchObject({ notice: 'expired' });
  });

  it('WEB-22 con una sesión activa va directo al destino', async () => {
    await sessionStore().set(SESSION_ID, sessionData());
    resetRequest({ cookies: { sid: SESSION_ID } });
    await expect(loginFormProps({ next: '/beneficiaries' })).rejects.toThrow(
      'NEXT_REDIRECT:/beneficiaries',
    );
  });
});
