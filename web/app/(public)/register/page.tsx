import type { Metadata } from 'next';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { BrandShell } from '@/components/layout/BrandShell';

export const metadata: Metadata = { title: 'Crear cuenta · TreoWallet' };

export default function RegisterPage() {
  return (
    <BrandShell title="Crea tu cuenta">
      <RegisterForm />
    </BrandShell>
  );
}
