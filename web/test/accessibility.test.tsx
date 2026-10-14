import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { login, register } from '@/app/actions/auth';
import { createBeneficiary } from '@/app/actions/beneficiaries';
import { createTransfer } from '@/app/actions/transfers';
import { LoginForm } from '@/components/auth/LoginForm';
import { RegisterForm } from '@/components/auth/RegisterForm';
import { NewBeneficiaryForm } from '@/components/beneficiaries/NewBeneficiaryForm';
import { TransferFlow } from '@/components/transfers/TransferFlow';
import { TransferForm } from '@/components/transfers/TransferForm';
import { bffGet } from '@/lib/client/bff';
import { BENEFICIARY, OVERVIEW, problem } from '@/test/fixtures';
import { setLocation } from '@/test/support/next-navigation';
import { renderWithClient } from '@/test/support/render';
import { fillTransfer, mockTransferReads } from '@/test/support/transfer-flow';

vi.mock('@/app/actions/auth', () => ({ login: vi.fn(), register: vi.fn() }));
vi.mock('@/app/actions/beneficiaries', () => ({ createBeneficiary: vi.fn() }));
vi.mock('@/app/actions/transfers', () => ({
  createTransfer: vi.fn(),
  confirmTransfer: vi.fn(),
  resendTransferOtp: vi.fn(),
}));
vi.mock('@/lib/client/bff', () => ({ bffGet: vi.fn() }));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

beforeEach(() => {
  vi.mocked(login).mockReset();
  vi.mocked(register).mockReset();
  vi.mocked(createBeneficiary).mockReset();
  vi.mocked(createTransfer).mockReset();
  vi.mocked(bffGet).mockReset();
  mockTransferReads(vi.mocked(bffGet));
  setLocation('/');
});

/** Envía el formulario vacío y devuelve el contenedor con los errores a la vista. */
async function submitEmpty(button: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: button }));
  return user;
}

describe('accesibilidad de los formularios', () => {
  it.each([
    ['inicio de sesión', <LoginForm key="login" />, 'Iniciar sesión', 'Correo'],
    ['registro', <RegisterForm key="register" />, 'Crear cuenta', 'Correo'],
    [
      'alta de beneficiario',
      <NewBeneficiaryForm key="beneficiary" />,
      'Agregar beneficiario',
      'Nombre del titular',
    ],
    [
      'transferencia',
      <TransferForm
        key="transfer"
        accounts={OVERVIEW.accounts}
        beneficiaries={[BENEFICIARY]}
        recipient={{ destinationType: 'BENEFICIARY', beneficiaryId: BENEFICIARY.id }}
        onSubmit={() => undefined}
      />,
      'Continuar',
      'Monto',
    ],
  ])(
    'WEB-23 %s: con errores, el foco va al primer campo inválido, cuyo error está asociado, y axe no reporta problemas',
    async (_name, form, button, firstField) => {
      const { container } = renderWithClient(form);

      await submitEmpty(button);

      const field = screen.getByLabelText(firstField);
      expect(field).toHaveFocus();
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field.getAttribute('aria-describedby')).toBeTruthy();
      expect(await axe(container)).toHaveNoViolations();
    },
  );

  it('WEB-23 cada campo del alta de beneficiario tiene una etiqueta asociada', () => {
    renderWithClient(<NewBeneficiaryForm />);
    for (const input of screen.getAllByRole('textbox')) {
      expect(input).toHaveAccessibleName();
    }
  });

  it('WEB-23 un error de operación se anuncia (role="alert") y recibe el foco', async () => {
    vi.mocked(login).mockResolvedValue({
      ok: false,
      problem: problem('INVALID_CREDENTIALS', { status: 401 }),
    });
    const user = userEvent.setup();
    renderWithClient(<LoginForm />);
    await user.type(screen.getByLabelText('Correo'), 'ana@example.com');
    await user.type(screen.getByLabelText('Contraseña'), 'x');
    await user.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveFocus();
  });

  it('WEB-23 la confirmación que falla por saldo insuficiente se anuncia y recibe el foco', async () => {
    vi.mocked(createTransfer).mockResolvedValue({
      ok: false,
      problem: problem('INSUFFICIENT_FUNDS'),
    });
    const user = userEvent.setup();
    const { container } = renderWithClient(<TransferFlow />);
    await fillTransfer(user, '30,000');
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveFocus();
    expect(alert).toHaveTextContent('Saldo insuficiente');
    expect(await axe(container)).toHaveNoViolations();
  });

  it('WEB-23 al cambiar de paso el foco va al título del paso', async () => {
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user);
    expect(await screen.findByRole('heading', { name: 'Revisa tu transferencia' })).toHaveFocus();
  });
});
