import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { loadPendingTransfer } from '@/session/pending-transfer';

/**
 * Al abrir la app con sesión (MOB-11): si el sistema mató la app a mitad de una transferencia,
 * abre el flujo, que la retoma con la misma llave y muestra el estado real. No dibuja nada.
 */
export function ResumePendingTransfer() {
  const router = useRouter();
  useEffect(() => {
    let active = true;
    void loadPendingTransfer().then((pending) => {
      if (!active || !pending) return;
      router.push({
        pathname: '/transfer/send',
        params: { beneficiaryId: pending.draft.beneficiaryId },
      });
    });
    return () => {
      active = false;
    };
  }, [router]);
  return null;
}
