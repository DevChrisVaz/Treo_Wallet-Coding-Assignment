import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AHORRO, BENEFICIARY, PRINCIPAL, problem } from '@/test/fixtures';
import type { TransferDraft } from '@/lib/client/transfer-flow';
import { TransferForm, type TransferFormProps } from './TransferForm';

const ACCOUNTS = [PRINCIPAL, AHORRO];
const TO_LUIS = { destinationType: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id } as const;

function renderForm(props: Partial<TransferFormProps> = {}) {
  const onSubmit = vi.fn<(draft: TransferDraft) => void>();
  render(
    <TransferForm
      accounts={ACCOUNTS}
      beneficiaries={[BENEFICIARY]}
      recipient={TO_LUIS}
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { onSubmit, user: userEvent.setup() };
}

function originOptions(): (string | null)[] {
  return within(screen.getByLabelText('Cuenta de origen'))
    .getAllByRole('option')
    .map((option) => option.textContent);
}

async function fillBeneficiaryTransfer(user: ReturnType<typeof userEvent.setup>, amount: string) {
  await user.type(screen.getByLabelText('Monto'), amount);
  await user.type(screen.getByLabelText('Concepto'), 'Renta');
  await user.type(screen.getByLabelText('Referencia'), '1');
  await user.click(screen.getByRole('button', { name: 'Continuar' }));
}

describe('TransferForm', () => {
  it('WEB-16 la cuenta de origen no ofrece la cuenta propia de destino', () => {
    renderForm({ recipient: { destinationType: 'OWN_ACCOUNT', toAccountId: AHORRO.id } });
    const options = originOptions();
    expect(options.some((text) => text?.startsWith('Principal'))).toBe(true);
    expect(options.some((text) => text?.startsWith('Ahorro'))).toBe(false);
  });

  it('WEB-16 si el acceso directo apunta a la cuenta de destino, el origen pasa a la otra cuenta (R38)', () => {
    renderForm({
      recipient: { destinationType: 'OWN_ACCOUNT', toAccountId: PRINCIPAL.id },
      defaultFromAccountId: PRINCIPAL.id,
    });
    expect(screen.getByLabelText('Cuenta de origen')).toHaveValue(AHORRO.id);
    expect(originOptions().some((text) => text?.startsWith('Principal'))).toBe(false);
  });

  it('WEB-30 muestra a quién se envía sobre el monto, que es el protagonista', () => {
    renderForm();
    expect(screen.getByText('Para')).toBeVisible();
    expect(screen.getByText('Luis · CLABE •••• 9735')).toBeVisible();
    expect(screen.getByTestId('hero-amount-mirror')).toBeInTheDocument();
  });

  it('WEB-25 las ayudas del concepto y de la referencia usan la redacción de la app móvil', () => {
    renderForm();
    expect(screen.getByLabelText('Concepto')).toHaveAccessibleDescription('De 1 a 40 caracteres.');
    expect(screen.getByLabelText('Referencia')).toHaveAccessibleDescription('De 1 a 7 dígitos.');
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
    const { onSubmit, user } = renderForm({
      recipient: { destinationType: 'OWN_ACCOUNT', toAccountId: PRINCIPAL.id },
      defaultFromAccountId: AHORRO.id,
    });
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

  it('WEB-07 valida concepto y referencia con el contrato', async () => {
    const { onSubmit, user } = renderForm();
    await user.type(screen.getByLabelText('Monto'), '10');
    await user.type(screen.getByLabelText('Referencia'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByLabelText('Concepto')).toHaveAccessibleDescription(
      expect.stringContaining('El concepto es obligatorio'),
    );
    expect(screen.getByLabelText('Referencia')).toHaveAccessibleDescription(
      expect.stringContaining('La referencia solo admite dígitos'),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('WEB-16 muestra el saldo disponible de la cuenta de origen', () => {
    renderForm();
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
        when: 'NOW',
        scheduledFor: '',
      },
    });
    expect(screen.getByLabelText('Monto')).toHaveValue('15,000');
    expect(screen.getByLabelText('Cuenta de origen')).toHaveValue(PRINCIPAL.id);
  });

  it('WEB-16 toma la cuenta de origen del acceso directo', () => {
    renderForm({ defaultFromAccountId: AHORRO.id });
    expect(screen.getByLabelText('Cuenta de origen')).toHaveValue(AHORRO.id);
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

describe('TransferForm · programar', () => {
  // 14 de octubre de 2026, 12:00 en la Ciudad de México.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T18:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const OUT_OF_RANGE = 'Elige una fecha entre mañana y 90 días después de hoy';
  const SCHEDULED_VALUES = {
    fromAccountId: PRINCIPAL.id,
    destinationType: 'BENEFICIARY',
    toAccountId: '',
    beneficiaryId: BENEFICIARY.id,
    amount: '1,000',
    concept: 'Renta',
    reference: '1',
    when: 'SCHEDULED',
    scheduledFor: '2026-10-20',
  } as const;

  /** Con Luis ya elegido en el paso anterior (`TO_LUIS`), como en el flujo por pasos (WEB-30). */
  async function fillScheduled(user: ReturnType<typeof userEvent.setup>, date: string) {
    await user.selectOptions(screen.getByLabelText('Cuenta de origen'), PRINCIPAL.id);
    await user.type(screen.getByLabelText('Monto'), '1,000');
    await user.type(screen.getByLabelText('Concepto'), 'Renta');
    await user.type(screen.getByLabelText('Referencia'), '1');
    await user.click(screen.getByRole('radio', { name: 'Programar' }));
    if (date) await user.type(screen.getByLabelText('Fecha de envío'), date);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
  }

  it('WEB-33 ofrece "Cuándo" con "Ahora" por defecto', () => {
    renderForm();
    expect(screen.getByRole('group', { name: 'Cuándo' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Ahora' })).toBeChecked();
  });

  it('WEB-33 con "Programar" y una fecha arma la petición con scheduledFor', async () => {
    const { onSubmit, user } = renderForm();

    await fillScheduled(user, '2026-10-20');

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0].request).toEqual({
      fromAccountId: PRINCIPAL.id,
      destination: { type: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id },
      amount: '1000',
      concept: 'Renta',
      reference: '1',
      scheduledFor: '2026-10-20',
    });
  });

  it('WEB-33 al volver a "Ahora" la petición no lleva fecha aunque se haya escrito una', async () => {
    const { onSubmit, user } = renderForm();
    await user.click(screen.getByRole('radio', { name: 'Programar' }));
    await user.type(screen.getByLabelText('Fecha de envío'), '2026-10-20');
    await user.click(screen.getByRole('radio', { name: 'Ahora' }));

    await fillBeneficiaryTransfer(user, '1,000');

    expect(onSubmit.mock.calls[0]?.[0].request).not.toHaveProperty('scheduledFor');
  });

  it.each([
    ['2026-10-14', 'hoy'],
    ['2027-01-13', 'a 91 días'],
  ])(
    'WEB-33 valida la fecha con el esquema del contrato: %s (%s) queda fuera de rango',
    async (date) => {
      const { onSubmit, user } = renderForm();

      await fillScheduled(user, date);

      const field = screen.getByLabelText('Fecha de envío');
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveAccessibleDescription(expect.stringContaining(OUT_OF_RANGE));
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it.each(['2026-10-15', '2027-01-12'])('WEB-33 acepta la fecha límite %s', async (date) => {
    const { onSubmit, user } = renderForm();
    await fillScheduled(user, date);
    expect(onSubmit.mock.calls[0]?.[0].request).toMatchObject({ scheduledFor: date });
  });

  it('WEB-33 "Programar" sin fecha pide la fecha', async () => {
    const { onSubmit, user } = renderForm();
    await fillScheduled(user, '');
    expect(screen.getByLabelText('Fecha de envío')).toHaveAccessibleDescription(
      expect.stringContaining('La fecha es obligatoria'),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('WEB-17 al editar recupera la fecha programada', () => {
    renderForm({ initialValues: SCHEDULED_VALUES });
    expect(screen.getByRole('radio', { name: 'Programar' })).toBeChecked();
    expect(screen.getByLabelText('Fecha de envío')).toHaveValue('2026-10-20');
  });

  it.each([
    ['/scheduledFor', 'DATE_OUT_OF_RANGE', 'Fecha de envío', OUT_OF_RANGE],
    [
      '/amount',
      'TOO_LARGE',
      'Monto',
      'Una transferencia programada a un tercero no puede superar el límite diario de $50,000.00',
    ],
  ] as const)(
    'WEB-33 WEB-23 un error de la API en %s (%s) se muestra junto a su campo, que recibe el foco',
    (pointer, code, label, message) => {
      renderForm({
        initialValues: SCHEDULED_VALUES,
        problem: problem('VALIDATION_FAILED', { errors: [{ pointer, code, message }] }),
      });

      const field = screen.getByLabelText(label);
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveAccessibleDescription(expect.stringContaining(message));
      expect(field).toHaveFocus();
    },
  );

  it('WEB-33 un error de la API sobre el destino, que se eligió en el paso anterior, se muestra en "Para"', () => {
    const message = 'Elige un beneficiario';
    renderForm({
      initialValues: SCHEDULED_VALUES,
      problem: problem('VALIDATION_FAILED', {
        errors: [{ pointer: '/destination/beneficiaryId', code: 'INVALID_FORMAT', message }],
      }),
    });
    expect(screen.getByText(message)).toHaveClass('text-danger');
    expect(screen.getByText('Para').parentElement).toHaveTextContent(message);
  });

  it('WEB-33 WEB-23 el error del destino se anuncia como alerta, porque no hay campo que reciba el foco', () => {
    const message = 'Elige un beneficiario';
    renderForm({
      initialValues: SCHEDULED_VALUES,
      problem: problem('VALIDATION_FAILED', {
        errors: [{ pointer: '/destination/beneficiaryId', code: 'INVALID_FORMAT', message }],
      }),
    });
    expect(screen.getByRole('alert')).toHaveTextContent(message);
  });

  it('WEB-33 WEB-23 con un error del destino primero, el foco va al primer error con campo en este paso', () => {
    const amountMessage =
      'Una transferencia programada a un tercero no puede superar el límite diario de $50,000.00';
    renderForm({
      initialValues: SCHEDULED_VALUES,
      problem: problem('VALIDATION_FAILED', {
        errors: [
          {
            pointer: '/destination/beneficiaryId',
            code: 'INVALID_FORMAT',
            message: 'Elige un beneficiario',
          },
          { pointer: '/amount', code: 'TOO_LARGE', message: amountMessage },
          { pointer: '/scheduledFor', code: 'DATE_OUT_OF_RANGE', message: OUT_OF_RANGE },
        ],
      }),
    });
    const amount = screen.getByLabelText('Monto');
    expect(amount).toHaveFocus();
    expect(amount).toHaveAccessibleDescription(expect.stringContaining(amountMessage));
    expect(screen.getByLabelText('Fecha de envío')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Elige un beneficiario');
  });

  it('WEB-23 con la fecha a la vista no hay problemas de accesibilidad', async () => {
    const { user } = renderForm();
    await fillScheduled(user, '2027-01-13');
    expect(
      await axe(screen.getByRole('button', { name: 'Continuar' }).closest('form') as HTMLElement),
    ).toHaveNoViolations();
  });
});
