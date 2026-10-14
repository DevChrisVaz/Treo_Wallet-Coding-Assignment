import { screen } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import type { vi } from 'vitest';
import type { bffGet } from '@/lib/client/bff';
import { BENEFICIARY, OVERVIEW, PRINCIPAL } from '@/test/fixtures';

type User = ReturnType<typeof userEvent.setup>;

/** Lecturas que necesita el flujo de transferencia: cuentas y beneficiarios. */
export function mockTransferReads(mock: ReturnType<typeof vi.mocked<typeof bffGet>>) {
  mock.mockImplementation(async (path: string) => {
    if (path === 'accounts') return OVERVIEW;
    if (path === 'beneficiaries') return { items: [BENEFICIARY] };
    throw new Error(`Lectura inesperada: ${path}`);
  });
}

/** Elige a Luis, llena el monto (Principal es el origen por omisión) y pasa a la revisión. */
export async function fillTransfer(user: User, amount = '5,000') {
  await user.click(await screen.findByRole('button', { name: /^Luis/ }));
  await user.type(await screen.findByLabelText('Monto'), amount);
  await user.selectOptions(screen.getByLabelText('Cuenta de origen'), PRINCIPAL.id);
  await user.type(screen.getByLabelText('Concepto'), 'Renta');
  await user.type(screen.getByLabelText('Referencia'), '1');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
}
