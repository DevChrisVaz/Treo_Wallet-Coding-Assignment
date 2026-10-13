import type { Metadata } from 'next';
import { MovementsScreen } from '@/components/accounts/MovementsScreen';

export const metadata: Metadata = { title: 'Movimientos · TreoWallet' };

export default async function MovementsPage({
  params,
}: PageProps<'/accounts/[accountId]/movements'>) {
  const { accountId } = await params;
  // La clave reinicia los filtros al cambiar de cuenta.
  return <MovementsScreen key={accountId} accountId={accountId} />;
}
