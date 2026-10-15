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
  await user.type(screen.getByLabelText('Referencia (opcional)'), '1');
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

  it('WEB-25 las ayudas del concepto y de la referencia (opcional, hasta 7 dígitos) usan la redacción de la app móvil', () => {
    renderForm();
    expect(screen.getByLabelText('Concepto')).toHaveAccessibleDescription('De 1 a 40 caracteres.');
    expect(screen.getByLabelText('Referencia (opcional)')).toHaveAccessibleDescription(
      'Hasta 7 dígitos.',
    );
  });

  it('WEB-21 el monto no admite un tercer decimal ni letras: se descartan al teclear', async () => {
    const { user } = renderForm();
    const amount = screen.getByLabelText('Monto');

    await user.type(amount, '100.005');
    expect(amount).toHaveValue('100.00');

    await user.clear(amount);
    await user.type(amount, '1a2b,3$4');
    expect(amount).toHaveValue('1,234');
  });

  it('WEB-21 da formato de miles mientras se escribe y al pegar', async () => {
    const { user } = renderForm();
    const amount = screen.getByLabelText('Monto');

    await user.type(amount, '12345.67');
    expect(amount).toHaveValue('12,345.67');

    await user.clear(amount);
    await user.click(amount);
    await user.paste('abc 007,000.509xyz');
    expect(amount).toHaveValue('7,000.50');
  });

  it('WEB-16 la referencia solo admite dígitos, hasta 7, y es opcional', async () => {
    const { onSubmit, user } = renderForm();
    const reference = screen.getByLabelText('Referencia (opcional)');
    expect(reference).toHaveAttribute('inputmode', 'numeric');

    await user.type(reference, 'a1b2-3');
    expect(reference).toHaveValue('123');
    await user.paste('45678999');
    expect(reference).toHaveValue('1234567');

    await user.clear(reference);
    await user.type(screen.getByLabelText('Monto'), '200');
    await user.type(screen.getByLabelText('Concepto'), 'Renta');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0].request).not.toHaveProperty('reference');
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
    await user.type(screen.getByLabelText('Referencia (opcional)'), '42');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(onSubmit.mock.calls[0]?.[0].request).toMatchObject({
      fromAccountId: AHORRO.id,
      destination: { type: 'OWN_ACCOUNT', accountId: PRINCIPAL.id },
      amount: '200',
    });
  });

  it('WEB-07 valida el concepto con el contrato', async () => {
    const { onSubmit, user } = renderForm();
    await user.type(screen.getByLabelText('Monto'), '10');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(screen.getByLabelText('Concepto')).toHaveAccessibleDescription(
      expect.stringContaining('El concepto es obligatorio'),
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
        scheduledTime: '',
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

  const OUT_OF_RANGE = 'Elige un momento entre 10 minutos y 90 días después de ahora';
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
    scheduledTime: '14:30',
  } as const;

  /** Con Luis ya elegido en el paso anterior (`TO_LUIS`), como en el flujo por pasos (WEB-30). */
  async function fillScheduled(
    user: ReturnType<typeof userEvent.setup>,
    date: string,
    time = '14:30',
  ) {
    await user.selectOptions(screen.getByLabelText('Cuenta de origen'), PRINCIPAL.id);
    await user.type(screen.getByLabelText('Monto'), '1,000');
    await user.type(screen.getByLabelText('Concepto'), 'Renta');
    await user.type(screen.getByLabelText('Referencia (opcional)'), '1');
    await user.click(screen.getByRole('radio', { name: 'Programar' }));
    if (date) await user.type(screen.getByLabelText('Fecha de envío'), date);
    if (time) await user.type(screen.getByLabelText('Hora de envío'), time);
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
  }

  it('WEB-33 ofrece "Cuándo" con "Ahora" por defecto', () => {
    renderForm();
    expect(screen.getByRole('group', { name: 'Cuándo' })).toBeVisible();
    expect(screen.getByRole('radio', { name: 'Ahora' })).toBeChecked();
  });

  it('WEB-33 con "Programar", fecha y hora arma el instante de la Ciudad de México en scheduledFor', async () => {
    const { onSubmit, user } = renderForm();

    await fillScheduled(user, '2026-10-20');

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0].request).toEqual({
      fromAccountId: PRINCIPAL.id,
      destination: { type: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id },
      amount: '1000',
      concept: 'Renta',
      reference: '1',
      // 14:30 en la Ciudad de México (UTC-6) son las 20:30 UTC.
      scheduledFor: '2026-10-20T20:30:00.000Z',
    });
  });

  it('WEB-33 al volver a "Ahora" la petición no lleva fecha aunque se haya escrito una', async () => {
    const { onSubmit, user } = renderForm();
    await user.click(screen.getByRole('radio', { name: 'Programar' }));
    await user.type(screen.getByLabelText('Fecha de envío'), '2026-10-20');
    await user.type(screen.getByLabelText('Hora de envío'), '14:30');
    await user.click(screen.getByRole('radio', { name: 'Ahora' }));

    await fillBeneficiaryTransfer(user, '1,000');

    expect(onSubmit.mock.calls[0]?.[0].request).not.toHaveProperty('scheduledFor');
  });

  it.each([
    ['2026-10-14', '12:05', 'a 5 minutos'],
    ['2026-10-14', '11:00', 'en el pasado'],
    ['2027-01-12', '12:01', 'pasados los 90 días'],
    ['2027-01-13', '09:00', 'a 91 días'],
  ])(
    'WEB-33 valida el momento con el contrato: %s %s (%s) queda fuera de rango',
    async (date, time) => {
      const { onSubmit, user } = renderForm();

      await fillScheduled(user, date, time);

      const field = screen.getByLabelText('Fecha de envío');
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveAccessibleDescription(expect.stringContaining(OUT_OF_RANGE));
      expect(onSubmit).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['2026-10-14', '12:10', '2026-10-14T18:10:00.000Z'],
    ['2027-01-12', '12:00', '2027-01-12T18:00:00.000Z'],
  ])('WEB-33 acepta el límite %s %s', async (date, time, instant) => {
    const { onSubmit, user } = renderForm();
    await fillScheduled(user, date, time);
    expect(onSubmit.mock.calls[0]?.[0].request).toMatchObject({ scheduledFor: instant });
  });

  it('WEB-33 "Programar" sin fecha pide la fecha', async () => {
    const { onSubmit, user } = renderForm();
    await fillScheduled(user, '');
    expect(screen.getByLabelText('Fecha de envío')).toHaveAccessibleDescription(
      expect.stringContaining('Elige la fecha de envío'),
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('WEB-33 "Programar" sin hora pide la hora y no marca la fecha', async () => {
    const { onSubmit, user } = renderForm();
    await fillScheduled(user, '2026-10-20', '');
    const time = screen.getByLabelText('Hora de envío');
    expect(time).toHaveAttribute('aria-invalid', 'true');
    expect(time).toHaveAccessibleDescription(expect.stringContaining('Elige la hora de envío'));
    expect(screen.getByLabelText('Fecha de envío')).not.toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('WEB-17 al editar recupera la fecha programada', () => {
    renderForm({ initialValues: SCHEDULED_VALUES });
    expect(screen.getByRole('radio', { name: 'Programar' })).toBeChecked();
    expect(screen.getByLabelText('Fecha de envío')).toHaveValue('2026-10-20');
    expect(screen.getByLabelText('Hora de envío')).toHaveValue('14:30');
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
