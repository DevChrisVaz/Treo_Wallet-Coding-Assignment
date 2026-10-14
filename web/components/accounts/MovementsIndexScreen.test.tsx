import { waitFor } from '@testing-library/react';
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
});
