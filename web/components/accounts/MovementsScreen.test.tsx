import { ProblemError, type MovementPage } from '@devchrisvaz/wallet-contract';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { bffGet, type QueryParams } from '@/lib/client/bff';
import { AHORRO, OVERVIEW, PRINCIPAL, movement } from '@/test/fixtures';
import { router, setLocation } from '@/test/support/next-navigation';
import { renderWithClient } from '@/test/support/render';
import { MovementsScreen } from './MovementsScreen';

vi.mock('@/lib/client/bff', () => ({ bffGet: vi.fn() }));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

const bffGetMock = vi.mocked(bffGet);
const MOVEMENTS_PATH = `accounts/${PRINCIPAL.id}/movements`;

const PAGE_1: MovementPage = {
  items: [
    movement({ id: 'm1', concept: 'Renta de octubre' }),
    movement({ id: 'm2', type: 'TRANSFER_OUT', amount: '-850.50', concept: 'Despensa' }),
  ],
  nextCursor: 'cursor-2',
};
const PAGE_2: MovementPage = {
  items: [movement({ id: 'm3', type: 'DEPOSIT', counterparty: null, concept: 'Depósito inicial' })],
  nextCursor: null,
};

/** Simula las lecturas: cuentas y, para movimientos, la función de la prueba. */
function reads(movements: (params: QueryParams) => Promise<MovementPage> | MovementPage) {
  bffGetMock.mockImplementation(async (path: string, params: QueryParams = {}) => {
    if (path === 'accounts') return OVERVIEW;
    if (path === MOVEMENTS_PATH) return movements(params);
    throw new Error(`Lectura inesperada: ${path}`);
  });
}

function movementCalls(): QueryParams[] {
  return bffGetMock.mock.calls
    .filter(([path]) => path === MOVEMENTS_PATH)
    .map(([, params]) => params ?? {});
}

beforeEach(() => {
  bffGetMock.mockReset();
  setLocation(`/accounts/${PRINCIPAL.id}/movements`);
});

describe('MovementsScreen', () => {
  it('WEB-14 muestra los movimientos de la cuenta en el orden que devuelve la API', async () => {
    reads(() => PAGE_1);
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);

    const list = await screen.findByRole('list', { name: 'Movimientos' });
    const rows = within(list).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Renta de octubre'),
      expect.stringContaining('Despensa'),
    ]);
    expect(rows[1]).toHaveTextContent('−$850.50');
    expect(movementCalls()[0]).toMatchObject({ cursor: undefined, type: [] });
  });

  it('WEB-14 "Cargar más" pide la página siguiente con el cursor y la agrega debajo', async () => {
    reads(({ cursor }) => (cursor === 'cursor-2' ? PAGE_2 : PAGE_1));
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);

    await user.click(await screen.findByRole('button', { name: 'Cargar más' }));

    await screen.findByText('Depósito inicial');
    const rows = within(screen.getByRole('list', { name: 'Movimientos' })).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[2]).toHaveTextContent('Depósito inicial');
    expect(movementCalls()[1]).toMatchObject({ cursor: 'cursor-2' });
  });

  it('WEB-14 en la última página oculta "Cargar más"', async () => {
    reads(() => PAGE_2);
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    await screen.findByText('Depósito inicial');
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument();
  });

  it('WEB-14 al cambiar el tipo a "Depósito" pide la primera página con el filtro y sin cursor', async () => {
    reads(({ cursor }) => (cursor === 'cursor-2' ? { ...PAGE_2, nextCursor: 'cursor-3' } : PAGE_1));
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    await user.click(await screen.findByRole('button', { name: 'Cargar más' }));
    await screen.findByText('Depósito inicial');

    await user.click(screen.getByRole('checkbox', { name: 'Depósito' }));

    await waitFor(() => expect(movementCalls()).toHaveLength(3));
    expect(movementCalls()[2]).toMatchObject({ type: ['DEPOSIT'], cursor: undefined });
  });

  it('WEB-14 filtra por rango de fechas y por varios tipos', async () => {
    reads(() => PAGE_2);
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    await screen.findByText('Depósito inicial');

    await user.type(screen.getByLabelText('Desde'), '2026-10-01');
    await user.type(screen.getByLabelText('Hasta'), '2026-10-13');
    await user.click(screen.getByRole('checkbox', { name: 'Transferencia recibida' }));
    await user.click(screen.getByRole('checkbox', { name: 'Traspaso recibido' }));

    await waitFor(() =>
      expect(movementCalls().at(-1)).toMatchObject({
        from: '2026-10-01',
        to: '2026-10-13',
        type: ['TRANSFER_IN', 'OWN_TRANSFER_IN'],
      }),
    );
  });

  it('WEB-14 ante INVALID_CURSOR vuelve a cargar la primera página con los filtros actuales', async () => {
    let firstPageLoads = 0;
    reads(({ cursor }) => {
      if (cursor === 'cursor-2') throw new ProblemError(400, { code: 'INVALID_CURSOR' });
      firstPageLoads += 1;
      return PAGE_1;
    });
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);

    await user.click(await screen.findByRole('button', { name: 'Cargar más' }));

    await waitFor(() => expect(firstPageLoads).toBe(2));
    expect(movementCalls().at(-1)).toMatchObject({ cursor: undefined });
    expect(await screen.findByText(/Renta de octubre/)).toBeVisible();
  });

  it('WEB-14 permite cambiar de cuenta', async () => {
    reads(() => PAGE_1);
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);

    const select = await screen.findByLabelText('Cuenta');
    await waitFor(() => expect(select).toHaveValue(PRINCIPAL.id));
    await user.selectOptions(select, AHORRO.id);

    expect(router.push).toHaveBeenCalledWith(`/accounts/${AHORRO.id}/movements`);
  });

  it('WEB-20 sin movimientos en el periodo muestra el estado vacío y limpia los filtros', async () => {
    reads(({ from }) => (from ? { items: [], nextCursor: null } : PAGE_2));
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    await screen.findByText('Depósito inicial');

    await user.type(screen.getByLabelText('Desde'), '2026-01-01');
    expect(await screen.findByText('No hay movimientos en este periodo')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(await screen.findByText('Depósito inicial')).toBeVisible();
    expect(screen.getByLabelText('Desde')).toHaveValue('');
  });

  it('WEB-20 si la lectura falla muestra el error con "Reintentar"', async () => {
    let attempt = 0;
    reads(() => {
      attempt += 1;
      if (attempt === 1) throw new TypeError('Failed to fetch');
      return PAGE_1;
    });
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar los movimientos');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText(/Renta de octubre/)).toBeVisible();
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    reads(() => PAGE_1);
    const { container } = renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    await screen.findByText(/Renta de octubre/);
    expect(await axe(container)).toHaveNoViolations();
  });
});
