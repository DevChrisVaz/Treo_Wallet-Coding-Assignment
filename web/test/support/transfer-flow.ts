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

/**
 * Llena el formulario con una transferencia a un beneficiario y pasa a la confirmación. Con
 * `scheduledFor`, elige "Programar" y escribe esa fecha (WEB-33).
 */
export async function fillTransfer(user: User, amount = '5,000', scheduledFor?: string) {
  await user.selectOptions(await screen.findByLabelText('Cuenta de origen'), PRINCIPAL.id);
  await user.click(screen.getByRole('radio', { name: 'Un beneficiario' }));
  await user.selectOptions(screen.getByLabelText('Beneficiario'), BENEFICIARY.id);
  await user.type(screen.getByLabelText('Monto'), amount);
  await user.type(screen.getByLabelText('Concepto'), 'Renta');
  await user.type(screen.getByLabelText('Referencia'), '1');
  if (scheduledFor) {
    await user.click(screen.getByRole('radio', { name: 'Programar' }));
    await user.type(screen.getByLabelText('Fecha de envío'), scheduledFor);
  }
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
}
