'use client';

import type { Account, Transfer } from '@devchrisvaz/wallet-contract';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect } from 'react';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Receipt } from '@/components/ui/Receipt';
import { StepActions } from '@/components/ui/StepActions';
import { queryKeys } from '@/lib/client/query-keys';
import type { StepActionsMode } from './OtpStep';

export interface ReceiptStepProps {
  transfer: Transfer;
  accounts: Account[];
  onRestart?: (() => void) | undefined;
  /** `fixed` en el flujo (WEB-30); `inline` en una página con pestañas (detalle). */
  actions?: StepActionsMode | undefined;
}

/**
 * Comprobante (WEB-16, D11): `Receipt` con `StatusBadge`. Una transferencia `COMPLETED` movió dinero,
 * así que se vuelven a consultar las cuentas y el historial. El título del paso lo da FlowHeader.
 */
export function ReceiptStep({
  transfer,
  accounts,
  onRestart,
  actions = 'fixed',
}: ReceiptStepProps) {
  const queryClient = useQueryClient();
  const completed = transfer.status === 'COMPLETED';

  useEffect(() => {
    if (!completed) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    void queryClient.invalidateQueries({ queryKey: queryKeys.allMovements });
  }, [completed, queryClient, transfer.id]);

  return (
    <>
      <Receipt
        transfer={transfer}
        fromAccount={accounts.find((account) => account.id === transfer.fromAccountId)}
      />
      <StepActions stacked={Boolean(onRestart)} fixed={actions === 'fixed'}>
        <Link href="/" className={buttonClasses('secondary')}>
          Ver mis cuentas
        </Link>
        {onRestart ? (
          <Button variant="ghost" onClick={onRestart}>
            Hacer otra transferencia
          </Button>
        ) : null}
      </StepActions>
    </>
  );
}
