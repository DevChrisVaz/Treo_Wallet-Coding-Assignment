import type { Metadata } from 'next';
import { MovementsIndexScreen } from '@/components/accounts/MovementsIndexScreen';

export const metadata: Metadata = { title: 'Movimientos · TreoWallet' };

export default function MovementsIndexPage() {
  return <MovementsIndexScreen />;
}
