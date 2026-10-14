import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AHORRO, PRINCIPAL } from '@/test/fixtures';
import {
  AccountSelectionProvider,
  selectedAccount,
  useAccountSelection,
} from './account-selection';

function Chooser({ label }: { label: string }) {
  const { accountId, select } = useAccountSelection();
  return (
    <button type="button" onClick={() => select(AHORRO.id)}>
      {label}: {accountId ?? 'ninguna'}
    </button>
  );
}

describe('selección de cuenta', () => {
  it('WEB-28 WEB-29 con el proveedor, Inicio y Movimientos comparten la cuenta elegida', async () => {
    render(
      <AccountSelectionProvider>
        <Chooser label="Inicio" />
        <Chooser label="Movimientos" />
      </AccountSelectionProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /^Inicio/ }));
    expect(screen.getByRole('button', { name: /^Movimientos/ })).toHaveTextContent(AHORRO.id);
  });

  it('WEB-28 sin proveedor la selección es local al componente', async () => {
    render(<Chooser label="Inicio" />);
    expect(screen.getByRole('button')).toHaveTextContent('ninguna');
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent(AHORRO.id);
  });

  it('WEB-28 si la cuenta elegida ya no existe, se usa la primera', () => {
    expect(selectedAccount([PRINCIPAL, AHORRO], AHORRO.id)).toBe(AHORRO);
    expect(selectedAccount([PRINCIPAL, AHORRO], 'otra')).toBe(PRINCIPAL);
    expect(selectedAccount([PRINCIPAL, AHORRO], null)).toBe(PRINCIPAL);
    expect(selectedAccount([], null)).toBeUndefined();
  });
});
