import type { Metadata } from 'next';
import { BeneficiariesScreen } from '@/components/beneficiaries/BeneficiariesScreen';

export const metadata: Metadata = { title: 'Beneficiarios · TreoWallet' };

export default function BeneficiariesPage() {
  return <BeneficiariesScreen />;
}
