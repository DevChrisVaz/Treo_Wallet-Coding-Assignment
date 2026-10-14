import type { Metadata } from 'next';
import { ScheduledTransfersScreen } from '@/components/transfers/ScheduledTransfersScreen';

export const metadata: Metadata = { title: 'Programadas · TreoWallet' };

/**
 * Transferencias programadas (WEB-34). Está en el grupo `(app)`, así que exige sesión (WEB-22);
 * el segmento estático `scheduled` tiene prioridad sobre `[transferId]`.
 */
export default function ScheduledTransfersPage() {
  return <ScheduledTransfersScreen />;
}
