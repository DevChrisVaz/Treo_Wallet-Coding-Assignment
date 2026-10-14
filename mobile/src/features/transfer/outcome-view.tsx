import type { Account } from '@devchrisvaz/wallet-contract';

import { InlineAlert, Receipt } from '@/components/ui';
import { errorMessage } from '@/lib/errors';

import type { AttemptState } from './transfer-attempt';

export type OutcomeState = Extract<AttemptState, { status: 'completed' | 'failed' | 'expired' }>;

interface OutcomeViewProps {
  state: OutcomeState;
  /** Cuenta de origen: el comprobante muestra su nombre y su terminación de CLABE. */
  account: Account | undefined;
}

/**
 * Resultado del intento con el estado real que devolvió la API (MOB-13). Una falla o un
 * vencimiento es el veredicto de la API sobre esa transferencia: el comprobante lo muestra, con el
 * mensaje de su `code` arriba; si el problema trae el estado real (`transferStatus`, p. ej. un
 * `409 TRANSFER_NOT_PENDING` de una ya rechazada), ese es el que se muestra. Las acciones van en el
 * pie del paso.
 */
export function OutcomeView({ state, account }: OutcomeViewProps) {
  if (state.status === 'completed') {
    return (
      <>
        {state.replayed ? (
          <InlineAlert
            tone="info"
            message="Tu transferencia ya se había registrado; este es su estado actual."
          />
        ) : null}
        <Receipt
          transfer={state.transfer}
          fromAccountName={account?.name}
          fromAccountClabe={account?.clabe}
        />
      </>
    );
  }

  return (
    <>
      <InlineAlert tone="danger" message={errorMessage(state.error)} />
      <Receipt
        transfer={{
          ...state.transfer,
          status: state.error.transferStatus ?? (state.status === 'expired' ? 'EXPIRED' : 'FAILED'),
        }}
        fromAccountName={account?.name}
        fromAccountClabe={account?.clabe}
      />
    </>
  );
}
