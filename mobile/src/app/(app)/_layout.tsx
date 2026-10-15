import { Stack } from 'expo-router';

import { ResumePendingTransfer } from '@/features/transfer/resume-pending-transfer';

/** Pantallas que requieren sesión (protegidas en la navegación raíz). */
export default function AppLayout() {
  return (
    <>
      <ResumePendingTransfer />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
