import type { Metadata } from 'next';
import { LoginForm } from '@/components/auth/LoginForm';

export const metadata: Metadata = { title: 'Iniciar sesión · TreoWallet' };

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { reason } = await searchParams;
  return (
    <>
      <h1 className="text-h1">Inicia sesión</h1>
      <LoginForm notice={reason === 'expired' ? 'expired' : undefined} />
    </>
  );
}
