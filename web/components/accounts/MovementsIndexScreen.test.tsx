import { ProblemError } from '@devchrisvaz/wallet-contract';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bffGet } from '@/lib/client/bff';
import { AccountSelectionProvider, useAccountSelection } from '@/lib/client/account-selection';
import { AHORRO, OVERVIEW, PRINCIPAL } from '@/test/fixtures';
import { router, setLocation } from '@/test/support/next-navigation';
import { renderWithClient } from '@/test/support/render';
import { MovementsIndexScreen } from './MovementsIndexScreen';

vi.mock('@/lib/client/bff', () => ({ bffGet: vi.fn() }));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

beforeEach(() => {
  vi.mocked(bffGet).mockReset();
  vi.mocked(bffGet).mockResolvedValue(OVERVIEW);
  setLocation('/movements');
});

function ChooseAhorro() {
  const { select } = useAccountSelection();
  useEffect(() => select(AHORRO.id), [select]);
  return null;
}

describe('MovementsIndexScreen', () => {
  it('WEB-29 /movements abre el historial de la primera cuenta', async () => {
    renderWithClient(<MovementsIndexScreen />);
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(`/accounts/${PRINCIPAL.id}/movements`),
    );
  });

  it('WEB-28 WEB-29 /movements abre el historial de la cuenta elegida en Inicio', async () => {
    renderWithClient(
      <AccountSelectionProvider>
        <ChooseAhorro />
        <MovementsIndexScreen />
      </AccountSelectionProvider>,
    );
    await waitFor(() =>
      expect(router.replace).toHaveBeenLastCalledWith(`/accounts/${AHORRO.id}/movements`),
    );
    expect(router.replace).not.toHaveBeenCalledWith(`/accounts/${PRINCIPAL.id}/movements`);
  });

  it('WEB-20 mientras lee las cuentas muestra el estado de carga', () => {
    vi.mocked(bffGet).mockReturnValue(new Promise(() => undefined));
    renderWithClient(<MovementsIndexScreen />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando movimientos');
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('WEB-20 si la lectura falla muestra el error y "Reintentar" abre el historial', async () => {
    vi.mocked(bffGet).mockRejectedValueOnce(new ProblemError(500, { code: 'INTERNAL_ERROR' }));
    const user = userEvent.setup();
    renderWithClient(<MovementsIndexScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tus cuentas');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(`/accounts/${PRINCIPAL.id}/movements`),
    );
  });

  it('WEB-20 sin cuentas muestra el estado vacío y no navega', async () => {
    vi.mocked(bffGet).mockResolvedValue({ ...OVERVIEW, accounts: [] });
    renderWithClient(<MovementsIndexScreen />);
    expect(await screen.findByRole('heading', { name: 'Aún no tienes cuentas' })).toBeVisible();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
