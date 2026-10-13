import type { Metadata } from 'next';
import { AccountsOverviewScreen } from '@/components/accounts/AccountsOverviewScreen';

export const metadata: Metadata = { title: 'Tus cuentas · TreoWallet' };

export default function HomePage() {
  return <AccountsOverviewScreen />;
}
