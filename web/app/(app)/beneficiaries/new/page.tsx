import type { Metadata } from 'next';
import { NewBeneficiaryForm } from '@/components/beneficiaries/NewBeneficiaryForm';

export const metadata: Metadata = { title: 'Agregar beneficiario · TreoWallet' };

export default function NewBeneficiaryPage() {
  return <NewBeneficiaryForm />;
}
