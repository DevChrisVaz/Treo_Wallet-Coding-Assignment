import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/LoginForm';
import { safeNextPath } from '@/lib/navigation';
import { currentSession } from '@/lib/server/session';

export const metadata: Metadata = { title: 'Iniciar sesión · TreoWallet' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next, reason } = await searchParams;
  // Solo rutas internas: un destino externo vuelve al resumen de cuentas (WEB-22).
  const redirectTo = safeNextPath(next);
  if (await currentSession()) redirect(redirectTo);

  return (
    <>
      <h1 className="text-h1">Inicia sesión</h1>
      <LoginForm redirectTo={redirectTo} notice={reason === 'expired' ? 'expired' : undefined} />
    </>
  );
}
