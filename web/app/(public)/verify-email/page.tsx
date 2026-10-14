import type { Metadata } from 'next';
import { VerifyEmailForm } from '@/components/auth/VerifyEmailForm';
import { BrandShell } from '@/components/layout/BrandShell';

export const metadata: Metadata = { title: 'Verifica tu correo · TreoWallet' };

export default async function VerifyEmailPage({ searchParams }: PageProps<'/verify-email'>) {
  const { email, registered } = await searchParams;
  return (
    <BrandShell title="Verifica tu correo">
      <VerifyEmailForm
        email={typeof email === 'string' ? email : ''}
        registered={registered === '1'}
      />
    </BrandShell>
  );
}
