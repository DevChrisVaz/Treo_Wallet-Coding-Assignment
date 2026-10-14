import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface AccountSelection {
  accountId: string | null;
  select: (accountId: string) => void;
}

const SelectionContext = createContext<AccountSelection | null>(null);

/** Cuenta elegida, compartida por Inicio y Movimientos durante la sesión (MOB-19, MOB-20). */
export function AccountSelectionProvider({ children }: { children: ReactNode }) {
  const [accountId, select] = useState<string | null>(null);
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
