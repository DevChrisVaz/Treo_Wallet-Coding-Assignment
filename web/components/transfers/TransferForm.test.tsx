import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AHORRO, BENEFICIARY, PRINCIPAL } from '@/test/fixtures';
import type { TransferDraft } from '@/lib/client/transfer-flow';
import { TransferForm, type TransferFormProps } from './TransferForm';

const ACCOUNTS = [PRINCIPAL, AHORRO];

function renderForm(props: Partial<TransferFormProps> = {}) {
  const onSubmit = vi.fn<(draft: TransferDraft) => void>();
  render(
    <TransferForm
      accounts={ACCOUNTS}
      beneficiaries={[BENEFICIARY]}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit, user: userEvent.setup() };
}

async function fillBeneficiaryTransfer(user: ReturnType<typeof userEvent.setup>, amount: string) {
  await user.selectOptions(screen.getByLabelText('Cuenta de origen'), PRINCIPAL.id);
  await user.click(screen.getByRole('radio', { name: 'Un beneficiario' }));
  await user.selectOptions(screen.getByLabelText('Beneficiario'), BENEFICIARY.id);
  await user.type(screen.getByLabelText('Monto'), amount);
  await user.type(screen.getByLabelText('Concepto'), 'Renta');
  await user.type(screen.getByLabelText('Referencia'), '1');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
}

describe('TransferForm', () => {
  it('WEB-16 como destino propio solo ofrece cuentas distintas de la de origen', async () => {
    const { user } = renderForm();

    await user.selectOptions(screen.getByLabelText('Cuenta de origen'), PRINCIPAL.id);
    await user.click(screen.getByRole('radio', { name: 'Mis cuentas' }));

    const destination = screen.getByLabelText('Cuenta de destino');
    const options = within(destination)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options.some((text) => text?.startsWith('Principal'))).toBe(false);
    expect(options.some((text) => text?.startsWith('Ahorro'))).toBe(true);
  });

  it('WEB-16 si el origen pasa a ser la cuenta de destino elegida, se limpia el destino', async () => {
    const { user } = renderForm();
    await user.selectOptions(screen.getByLabelText('Cuenta de origen'), PRINCIPAL.id);
    await user.click(screen.getByRole('radio', { name: 'Mis cuentas' }));
    await user.selectOptions(screen.getByLabelText('Cuenta de destino'), AHORRO.id);

    await user.selectOptions(screen.getByLabelText('Cuenta de origen'), AHORRO.id);

    expect(screen.getByLabelText('Cuenta de destino')).toHaveValue('');
  });

  it('WEB-21 un monto con tres decimales se rechaza en el formulario, sin redondear', async () => {
    const { onSubmit, user } = renderForm();

    await fillBeneficiaryTransfer(user, '100.005');

    const amount = screen.getByLabelText('Monto');
    expect(amount).toHaveAttribute('aria-invalid', 'true');
    expect(amount).toHaveAccessibleDescription(expect.stringContaining('máximo 2 decimales'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('WEB-21 quita los separadores de miles y envía el monto como texto', async () => {
    const { onSubmit, user } = renderForm();

    await fillBeneficiaryTransfer(user, '1,250.50');

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0].request).toEqual({
      fromAccountId: PRINCIPAL.id,
      destination: { type: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id },
      amount: '1250.50',
      concept: 'Renta',
      reference: '1',
    });
    expect(onSubmit.mock.calls[0]?.[0].values.amount).toBe('1,250.50');
  });

  it('WEB-16 arma el destino de cuenta propia', async () => {
    const { onSubmit, user } = renderForm();
    await user.selectOptions(screen.getByLabelText('Cuenta de origen'), AHORRO.id);
    await user.click(screen.getByRole('radio', { name: 'Mis cuentas' }));
    await user.selectOptions(screen.getByLabelText('Cuenta de destino'), PRINCIPAL.id);
    await user.type(screen.getByLabelText('Monto'), '200');
    await user.type(screen.getByLabelText('Concepto'), 'Apartado');
    await user.type(screen.getByLabelText('Referencia'), '42');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(onSubmit.mock.calls[0]?.[0].request).toMatchObject({
      fromAccountId: AHORRO.id,
      destination: { type: 'OWN_ACCOUNT', accountId: PRINCIPAL.id },
      amount: '200',
    });
  });

  it('WEB-07 valida concepto, referencia y destino con el contrato', async () => {
    const { onSubmit, user } = renderForm();
    await user.selectOptions(screen.getByLabelText('Cuenta de origen'), PRINCIPAL.id);
    await user.type(screen.getByLabelText('Monto'), '10');
    await user.type(screen.getByLabelText('Referencia'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByLabelText('Concepto')).toHaveAccessibleDescription(
      expect.stringContaining('El concepto es obligatorio'),
    );
    expect(screen.getByLabelText('Referencia')).toHaveAccessibleDescription(
      expect.stringContaining('La referencia solo admite dígitos'),
    );
    expect(screen.getByLabelText('Beneficiario')).toHaveAccessibleDescription(
      expect.stringContaining('Elige un beneficiario'),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('WEB-16 muestra el saldo disponible de la cuenta de origen', async () => {
    const { user } = renderForm();
    await user.selectOptions(screen.getByLabelText('Cuenta de origen'), PRINCIPAL.id);
    expect(screen.getByLabelText('Cuenta de origen')).toHaveAccessibleDescription(
      'Saldo disponible: $25,000.00',
    );
  });

  it('WEB-17 al editar recupera lo que se había escrito', () => {
    renderForm({
      initialValues: {
        fromAccountId: PRINCIPAL.id,
        destinationType: 'BENEFICIARY',
        toAccountId: '',
        beneficiaryId: BENEFICIARY.id,
        amount: '15,000',
        concept: 'Renta',
        reference: '7',
      },
    });
    expect(screen.getByLabelText('Monto')).toHaveValue('15,000');
    expect(screen.getByLabelText('Beneficiario')).toHaveValue(BENEFICIARY.id);
  });

  it('WEB-16 toma la cuenta y el beneficiario de los accesos directos', () => {
    renderForm({ defaultFromAccountId: AHORRO.id, defaultBeneficiaryId: BENEFICIARY.id });
    expect(screen.getByLabelText('Cuenta de origen')).toHaveValue(AHORRO.id);
    expect(screen.getByRole('radio', { name: 'Un beneficiario' })).toBeChecked();
    expect(screen.getByLabelText('Beneficiario')).toHaveValue(BENEFICIARY.id);
  });

  it('WEB-15 sin beneficiarios sugiere agregar uno', async () => {
    const { user } = renderForm({ beneficiaries: [] });
    await user.click(screen.getByRole('radio', { name: 'Un beneficiario' }));
    expect(screen.getByRole('link', { name: 'Agregar beneficiario' })).toHaveAttribute(
      'href',
      '/beneficiaries/new',
    );
  });

  it('DSG-12 el mensaje de misma cuenta viene del paquete de diseño', () => {
    expect(problemMessage('SAME_ACCOUNT_TRANSFER')).toBe(
      'Elige una cuenta de destino distinta a la de origen.',
    );
  });

  it('WEB-23 cada campo tiene su etiqueta y no hay problemas de accesibilidad', async () => {
    const { user } = renderForm();
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      await axe(screen.getByRole('button', { name: 'Continuar' }).closest('form') as HTMLElement),
    ).toHaveNoViolations();
  });
});
