import type { Metadata } from 'next';
import { VerifyEmailForm } from '@/components/auth/VerifyEmailForm';

export const metadata: Metadata = { title: 'Verifica tu correo · TreoWallet' };

export default async function VerifyEmailPage({ searchParams }: PageProps<'/verify-email'>) {
  const { email, registered } = await searchParams;
  return (
    <>
      <h1 className="text-h1">Verifica tu correo</h1>
      <VerifyEmailForm
        email={typeof email === 'string' ? email : ''}
        registered={registered === '1'}
      />
    </>
  );
}
