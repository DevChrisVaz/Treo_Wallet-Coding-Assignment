import type { Metadata } from 'next';
import { RegisterForm } from '@/components/auth/RegisterForm';

export const metadata: Metadata = { title: 'Crear cuenta · TreoWallet' };

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-h1">Crea tu cuenta</h1>
      <RegisterForm />
    </>
  );
}
