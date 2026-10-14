'use client';

import type { Account, Transfer } from '@devchrisvaz/wallet-contract';
import { useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect } from 'react';
import { Button, buttonClasses } from '@/components/ui/Button';
import { Receipt } from '@/components/ui/Receipt';
import { queryKeys } from '@/lib/client/query-keys';
import { ScheduledOutcome } from './ScheduleField';
import { StepHeading } from './StepHeading';

export interface ReceiptStepProps {
  transfer: Transfer;
  accounts: Account[];
  onRestart?: (() => void) | undefined;
}

/**
 * Comprobante (WEB-16, D11): `Receipt` con `StatusBadge`. Una transferencia `COMPLETED` movió dinero,
 * así que se vuelven a consultar las cuentas y el historial. Una `SCHEDULED` no movió dinero: se
 * anuncia como programada, con su fecha y el enlace a las programadas (WEB-33).
 */
export function ReceiptStep({ transfer, accounts, onRestart }: ReceiptStepProps) {
  const queryClient = useQueryClient();
  const completed = transfer.status === 'COMPLETED';
  const scheduled = transfer.status === 'SCHEDULED';

  useEffect(() => {
    if (!completed) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.accounts });
    void queryClient.invalidateQueries({ queryKey: queryKeys.allMovements });
  }, [completed, queryClient, transfer.id]);

  return (
    <section aria-labelledby="receipt-step-title" className="grid gap-5">
      <StepHeading id="receipt-step-title">
        {completed
          ? 'Transferencia enviada'
          : scheduled
            ? 'Transferencia programada'
            : 'Estado de la transferencia'}
      </StepHeading>
      {scheduled && transfer.scheduledFor ? (
        <ScheduledOutcome scheduledFor={transfer.scheduledFor} />
      ) : null}
      <Receipt
        transfer={transfer}
        fromAccount={accounts.find((account) => account.id === transfer.fromAccountId)}
      />
      <div className="flex flex-wrap gap-3">
        <Link href="/" className={buttonClasses('secondary')}>
          Ver mis cuentas
        </Link>
        {onRestart ? (
          <Button variant="ghost" onClick={onRestart}>
            Hacer otra transferencia
          </Button>
        ) : null}
      </div>
    </section>
  );
}
