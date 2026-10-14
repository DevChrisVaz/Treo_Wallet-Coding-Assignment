import type { Metadata } from 'next';
import { TransferDetailScreen } from '@/components/transfers/TransferDetailScreen';

export const metadata: Metadata = { title: 'Transferencia · TreoWallet' };

export default async function TransferPage({ params }: PageProps<'/transfers/[transferId]'>) {
  const { transferId } = await params;
  return (
    <div className="mx-auto grid w-full max-w-xl gap-6">
      <TransferDetailScreen transferId={transferId} />
    </div>
  );
}
