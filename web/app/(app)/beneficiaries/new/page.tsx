import type { Metadata } from 'next';
import Link from 'next/link';
import { NewBeneficiaryForm } from '@/components/beneficiaries/NewBeneficiaryForm';

export const metadata: Metadata = { title: 'Agregar beneficiario · TreoWallet' };

export default function NewBeneficiaryPage() {
  return (
    <div className="mx-auto grid w-full max-w-md gap-6">
      <Link href="/beneficiaries" className="text-body-sm text-action underline underline-offset-2">
        Volver a beneficiarios
      </Link>
      <NewBeneficiaryForm />
    </div>
  );
}
