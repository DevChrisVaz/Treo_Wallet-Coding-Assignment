import type { Metadata } from 'next';
import { TransferFlow } from '@/components/transfers/TransferFlow';

export const metadata: Metadata = { title: 'Nueva transferencia · TreoWallet' };

export default async function NewTransferPage({ searchParams }: PageProps<'/transfers/new'>) {
  const { from, beneficiary } = await searchParams;
  return (
    <div className="mx-auto grid w-full max-w-xl gap-6">
      <h1 className="text-h1">Nueva transferencia</h1>
      <TransferFlow
        defaultFromAccountId={typeof from === 'string' ? from : undefined}
        defaultBeneficiaryId={typeof beneficiary === 'string' ? beneficiary : undefined}
      />
    </div>
  );
}
