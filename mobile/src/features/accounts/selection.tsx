import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { Session } from '@/session/session';

export interface AccountSelection {
  accountId: string | null;
  select: (accountId: string) => void;
}

const SelectionContext = createContext<AccountSelection | null>(null);

/**
 * Cuenta elegida, compartida por Inicio y Movimientos durante la sesión (MOB-19, MOB-20). Al cerrar
 * sesión se olvida, como los demás datos en memoria de la persona (MOB-04).
 */
export function AccountSelectionProvider({
  session,
  children,
}: {
  session: Session;
  children: ReactNode;
}) {
  const [accountId, select] = useState<string | null>(null);
  useEffect(
    () =>
      session.subscribe(() => {
        if (session.getSnapshot().status === 'signedOut') select(null);
      }),
    [session],
  );
  const value = useMemo(() => ({ accountId, select }), [accountId]);
  return <SelectionContext value={value}>{children}</SelectionContext>;
}

/** Sin proveedor (pruebas de un componente suelto), la selección es local. */
export function useAccountSelection(): AccountSelection {
  const shared = useContext(SelectionContext);
  const [accountId, select] = useState<string | null>(null);
  return shared ?? { accountId, select };
}

/** La cuenta elegida si sigue existiendo; si no, la primera. */
export function selectedAccount<T extends { id: string }>(
  accounts: readonly T[],
  accountId: string | null,
): T | undefined {
  return accounts.find((account) => account.id === accountId) ?? accounts[0];
}
