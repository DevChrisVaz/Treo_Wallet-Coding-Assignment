import type { Metadata } from 'next';
import { TransferFlow } from '@/components/transfers/TransferFlow';

export const metadata: Metadata = { title: 'Nueva transferencia · TreoWallet' };

/** Flujo de transferencia: FlowHeader da el h1 de cada paso y AppFrame lo muestra sin pestañas. */
export default async function NewTransferPage({ searchParams }: PageProps<'/transfers/new'>) {
  const { from, beneficiary } = await searchParams;
  return (
    <TransferFlow
      defaultFromAccountId={typeof from === 'string' ? from : undefined}
      defaultBeneficiaryId={typeof beneficiary === 'string' ? beneficiary : undefined}
    />
  );
}
