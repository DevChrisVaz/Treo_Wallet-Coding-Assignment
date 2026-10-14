import { ProblemError, type Beneficiary } from '@devchrisvaz/wallet-contract';
import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { createBeneficiary } from '@/app/actions/beneficiaries';
import { bffGet } from '@/lib/client/bff';
import { queryKeys } from '@/lib/client/query-keys';
import { BENEFICIARY, problem } from '@/test/fixtures';
import { router, setLocation } from '@/test/support/next-navigation';
import { renderWithClient } from '@/test/support/render';
import { BeneficiariesScreen } from './BeneficiariesScreen';
import { NewBeneficiaryForm } from './NewBeneficiaryForm';

vi.mock('@/app/actions/beneficiaries', () => ({ createBeneficiary: vi.fn() }));
vi.mock('@/lib/client/bff', () => ({ bffGet: vi.fn() }));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

const createMock = vi.mocked(createBeneficiary);
const bffGetMock = vi.mocked(bffGet);

const ANA: Beneficiary = {
  id: '5a0c9e8d-7b6a-4f5e-9d4c-3b2a1f0e9d8c',
  name: 'Ana Ruiz',
  alias: 'Ana',
  clabe: '032180000118359780',
  createdAt: '2026-10-03T10:00:00.000Z',
};

beforeEach(() => {
  createMock.mockReset();
  bffGetMock.mockReset();
  setLocation('/beneficiaries');
});

describe('BeneficiariesScreen', () => {
  it('WEB-15 lista los beneficiarios con alias, nombre y CLABE enmascarada', async () => {
    bffGetMock.mockResolvedValue({ items: [ANA, BENEFICIARY] });
    renderWithClient(<BeneficiariesScreen />);

    const list = await screen.findByRole('list', { name: 'Beneficiarios' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Ana');
    expect(rows[1]).toHaveTextContent('Luis Pérez Ramírez');
    expect(rows[1]).toHaveTextContent('•••• 9735');
    expect(
      within(rows[1] as HTMLElement).getByRole('link', { name: 'Transferir a Luis' }),
    ).toHaveAttribute('href', `/transfers/new?beneficiary=${BENEFICIARY.id}`);
    expect(bffGetMock).toHaveBeenCalledWith('beneficiaries');
  });

  it('WEB-20 sin beneficiarios muestra "Aún no tienes beneficiarios" con "Agregar beneficiario"', async () => {
    bffGetMock.mockResolvedValue({ items: [] });
    renderWithClient(<BeneficiariesScreen />);
    expect(
      await screen.findByRole('heading', { name: 'Aún no tienes beneficiarios' }),
    ).toBeVisible();
    const actions = screen.getAllByRole('link', { name: 'Agregar beneficiario' });
    expect(actions.at(-1)).toHaveAttribute('href', '/beneficiaries/new');
  });

  it('WEB-20 si la lectura falla muestra el error con "Reintentar"', async () => {
    bffGetMock.mockRejectedValueOnce(new ProblemError(503, { code: 'INTERNAL_ERROR' }));
    bffGetMock.mockResolvedValueOnce({ items: [BENEFICIARY] });
    const user = userEvent.setup();
    renderWithClient(<BeneficiariesScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos cargar tus beneficiarios',
    );
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Luis Pérez Ramírez')).toBeVisible();
  });

  it('WEB-20 muestra un estado de carga', () => {
    bffGetMock.mockReturnValue(new Promise(() => undefined));
    renderWithClient(<BeneficiariesScreen />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando tus beneficiarios');
  });

  it('WEB-25 cada fila lleva el avatar con las iniciales y "Transferir a <alias>" abre el flujo con ese beneficiario', async () => {
    bffGetMock.mockResolvedValue({ items: [BENEFICIARY] });
    renderWithClient(<BeneficiariesScreen />);
    const row = within(await screen.findByRole('list', { name: 'Beneficiarios' })).getByRole(
      'listitem',
    );
    expect(within(row).getByText('LP')).toHaveAttribute('aria-hidden', 'true');
    expect(within(row).getByText('CLABE •••• 9735')).toBeVisible();
    expect(within(row).getByRole('link', { name: 'Transferir a Luis' })).toHaveAttribute(
      'href',
      `/transfers/new?beneficiary=${BENEFICIARY.id}`,
    );
  });

  it('WEB-27 en teléfono "Agregar beneficiario" va arriba de la lista', async () => {
    bffGetMock.mockResolvedValue({ items: [BENEFICIARY] });
    renderWithClient(<BeneficiariesScreen />);
    await screen.findByRole('list', { name: 'Beneficiarios' });
    const add = screen.getByRole('link', { name: 'Agregar beneficiario' });
    expect(add).toHaveAttribute('href', '/beneficiaries/new');
    expect(add).toHaveClass('dashboard:hidden');
  });
});

async function fillForm(clabe = BENEFICIARY.clabe) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Nombre del titular'), BENEFICIARY.name);
  await user.type(screen.getByLabelText('Alias'), BENEFICIARY.alias);
  await user.type(screen.getByLabelText('CLABE'), clabe);
  await user.click(screen.getByRole('button', { name: 'Agregar beneficiario' }));
}

describe('NewBeneficiaryForm', () => {
  it('WEB-25 WEB-26 "Cancelar" vuelve a la lista y el envío ocupa todo el ancho en teléfono', () => {
    renderWithClient(<NewBeneficiaryForm />);
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute(
      'href',
      '/beneficiaries',
    );
    expect(screen.getByRole('button', { name: 'Agregar beneficiario' }).parentElement).toHaveClass(
      'grid',
      'gap-3',
    );
  });

  it('WEB-15 un alta exitosa lo muestra en la lista sin recargar la página', async () => {
    createMock.mockResolvedValue({ ok: true, data: BENEFICIARY });
    const { client } = renderWithClient(<NewBeneficiaryForm />);
    client.setQueryData(queryKeys.beneficiaries, { items: [ANA] });

    await fillForm();

    expect(createMock).toHaveBeenCalledWith({
      name: BENEFICIARY.name,
      alias: BENEFICIARY.alias,
      clabe: BENEFICIARY.clabe,
    });
    expect(client.getQueryData(queryKeys.beneficiaries)).toEqual({ items: [ANA, BENEFICIARY] });
    expect(client.getQueryState(queryKeys.beneficiaries)?.isInvalidated).toBe(true);
    expect(router.push).toHaveBeenCalledWith('/beneficiaries');
  });

  it('WEB-15 una CLABE con dígito verificador incorrecto se marca inválida y no se envía', async () => {
    renderWithClient(<NewBeneficiaryForm />);

    await fillForm('032180000118359718');

    const clabe = screen.getByLabelText('CLABE');
    expect(clabe).toHaveAttribute('aria-invalid', 'true');
    expect(clabe).toHaveAccessibleDescription(
      expect.stringContaining('El dígito verificador de la CLABE no es válido'),
    );
    expect(createMock).not.toHaveBeenCalled();
  });

  it.each(['CLABE_INVALID', 'CLABE_NOT_IN_PLATFORM', 'BENEFICIARY_IS_OWN_ACCOUNT'] as const)(
    'WEB-15 muestra en la CLABE el mensaje específico de %s',
    async (code) => {
      createMock.mockResolvedValue({ ok: false, problem: problem(code) });
      renderWithClient(<NewBeneficiaryForm />);

      await fillForm();

      const clabe = screen.getByLabelText('CLABE');
      expect(await screen.findByText(problemMessage(code))).toBeVisible();
      expect(clabe).toHaveAttribute('aria-invalid', 'true');
      expect(clabe).toHaveFocus();
      expect(router.push).not.toHaveBeenCalled();
    },
  );

  it('WEB-15 BENEFICIARY_CONFLICT se anuncia como alerta', async () => {
    createMock.mockResolvedValue({
      ok: false,
      problem: problem('BENEFICIARY_CONFLICT', { status: 409 }),
    });
    renderWithClient(<NewBeneficiaryForm />);

    await fillForm();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(problemMessage('BENEFICIARY_CONFLICT'));
    expect(alert).toHaveFocus();
  });

  it('WEB-23 cada campo tiene su etiqueta y no hay problemas de accesibilidad', async () => {
    const { container } = renderWithClient(<NewBeneficiaryForm />);
    expect(screen.getByLabelText('Nombre del titular')).toBeVisible();
    expect(screen.getByLabelText('Alias')).toBeVisible();
    expect(screen.getByLabelText('CLABE')).toBeVisible();
    expect(await axe(container)).toHaveNoViolations();
  });
});
