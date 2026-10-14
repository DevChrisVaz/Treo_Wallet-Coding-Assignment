import { ProblemError, type MovementPage } from '@devchrisvaz/wallet-contract';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { AccountSelectionProvider } from '@/lib/client/account-selection';
import { bffDownload, bffGet, type QueryParams } from '@/lib/client/bff';
import { AHORRO, OVERVIEW, PRINCIPAL, movement } from '@/test/fixtures';
import { router, setLocation } from '@/test/support/next-navigation';
import { renderWithClient } from '@/test/support/render';
import { MovementsIndexScreen } from './MovementsIndexScreen';
import { MovementsScreen } from './MovementsScreen';

vi.mock('@/lib/client/bff', () => ({ bffGet: vi.fn(), bffDownload: vi.fn() }));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

const bffGetMock = vi.mocked(bffGet);
const bffDownloadMock = vi.mocked(bffDownload);
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

type User = ReturnType<typeof userEvent.setup>;

async function openFilters(user: User) {
  await user.click(await screen.findByRole('button', { name: 'Filtros' }));
  return screen.getByRole('dialog', { name: 'Filtrar movimientos' });
}

/** Abre la hoja, llena lo indicado y pulsa "Aplicar". */
async function applyFilters(
  user: User,
  { from, to, types = [] }: { from?: string; to?: string; types?: string[] },
) {
  const sheet = await openFilters(user);
  if (from) await user.type(within(sheet).getByLabelText('Desde'), from);
  if (to) await user.type(within(sheet).getByLabelText('Hasta'), to);
  for (const type of types) await user.click(within(sheet).getByRole('checkbox', { name: type }));
  await user.click(within(sheet).getByRole('button', { name: 'Aplicar' }));
}

/** Filas del historial: las de todos los días, en orden. */
function rows() {
  return within(screen.getByRole('region', { name: 'Movimientos' })).getAllByRole('listitem');
}

beforeEach(() => {
  bffGetMock.mockReset();
  setLocation(`/accounts/${PRINCIPAL.id}/movements`);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('MovementsScreen', () => {
  it('WEB-14 muestra los movimientos de la cuenta en el orden que devuelve la API', async () => {
    reads(() => PAGE_1);
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);

    await screen.findByText(/Despensa/);
    expect(rows().map((row) => row.textContent)).toEqual([
      expect.stringContaining('Renta de octubre'),
      expect.stringContaining('Despensa'),
    ]);
    expect(rows()[1]).toHaveTextContent('−$850.50');
    expect(movementCalls()[0]).toMatchObject({ cursor: undefined, type: [] });
  });

  it('WEB-14 "Cargar más" pide la página siguiente con el cursor y la agrega debajo', async () => {
    reads(({ cursor }) => (cursor === 'cursor-2' ? PAGE_2 : PAGE_1));
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);

    await user.click(await screen.findByRole('button', { name: 'Cargar más' }));

    await screen.findByText('Depósito inicial');
    expect(rows()).toHaveLength(3);
    expect(rows()[2]).toHaveTextContent('Depósito inicial');
    expect(movementCalls()[1]).toMatchObject({ cursor: 'cursor-2' });
  });

  it('WEB-14 en la última página oculta "Cargar más"', async () => {
    reads(() => PAGE_2);
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    await screen.findByText('Depósito inicial');
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument();
  });

  it('WEB-14 WEB-29 al aplicar el tipo "Depósito" pide la primera página con el filtro y sin cursor', async () => {
    reads(({ cursor }) => (cursor === 'cursor-2' ? { ...PAGE_2, nextCursor: 'cursor-3' } : PAGE_1));
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    await user.click(await screen.findByRole('button', { name: 'Cargar más' }));
    await screen.findByText('Depósito inicial');

    await applyFilters(user, { types: ['Depósito'] });

    await waitFor(() => expect(movementCalls()).toHaveLength(3));
    expect(movementCalls()[2]).toMatchObject({ type: ['DEPOSIT'], cursor: undefined });
  });

  it('WEB-14 WEB-29 filtra por rango de fechas y por varios tipos', async () => {
    reads(() => PAGE_2);
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    await screen.findByText('Depósito inicial');

    await applyFilters(user, {
      from: '2026-10-01',
      to: '2026-10-13',
      types: ['Transferencia recibida', 'Traspaso recibido'],
    });

    await waitFor(() =>
      expect(movementCalls().at(-1)).toMatchObject({
        from: '2026-10-01',
        to: '2026-10-13',
        type: ['TRANSFER_IN', 'OWN_TRANSFER_IN'],
      }),
    );
  });

  it('WEB-14 WEB-29 con "Desde" posterior a "Hasta" marca "Hasta", no aplica ni consulta la API hasta corregirlo', async () => {
    reads(() => PAGE_2);
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    await screen.findByText('Depósito inicial');

    const sheet = await openFilters(user);
    await user.type(within(sheet).getByLabelText('Hasta'), '2026-10-11');
    await user.type(within(sheet).getByLabelText('Desde'), '2026-10-12');
    const to = within(sheet).getByLabelText('Hasta');
    expect(to).toHaveAttribute('aria-invalid', 'true');
    expect(to).toHaveAccessibleDescription(/Elige una fecha igual o posterior a la de Desde\./);
    await user.click(within(sheet).getByRole('button', { name: 'Aplicar' }));
    expect(screen.getByRole('dialog', { name: 'Filtrar movimientos' })).toBeInTheDocument();
    expect(movementCalls().some((params) => params.from === '2026-10-12')).toBe(false);
    expect(screen.queryByText('No pudimos cargar los movimientos')).not.toBeInTheDocument();

    await user.clear(within(sheet).getByLabelText('Desde'));
    await user.type(within(sheet).getByLabelText('Desde'), '2026-10-01');
    expect(within(sheet).getByLabelText('Hasta')).not.toHaveAttribute('aria-invalid');
    await user.click(within(sheet).getByRole('button', { name: 'Aplicar' }));

    await waitFor(() =>
      expect(movementCalls().at(-1)).toMatchObject({
        from: '2026-10-01',
        to: '2026-10-11',
        cursor: undefined,
      }),
    );
    expect(screen.queryByRole('dialog', { name: 'Filtrar movimientos' })).not.toBeInTheDocument();
  });

  it('WEB-29 cerrar la hoja sin "Aplicar" no cambia los filtros; "Limpiar" los quita y la cierra', async () => {
    reads(({ type }) => (Array.isArray(type) && type.length > 0 ? PAGE_2 : PAGE_1));
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    await screen.findByText(/Renta de octubre/);

    let sheet = await openFilters(user);
    await user.type(within(sheet).getByLabelText('Desde'), '2026-10-01');
    await user.click(within(sheet).getByRole('button', { name: 'Cerrar' }));
    expect(movementCalls()).toHaveLength(1);
    sheet = await openFilters(user);
    expect(within(sheet).getByLabelText('Desde')).toHaveValue('');

    await user.click(within(sheet).getByRole('checkbox', { name: 'Depósito' }));
    await user.click(within(sheet).getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByText('Depósito inicial')).toBeVisible();
    expect(movementCalls().at(-1)).toMatchObject({ type: ['DEPOSIT'], from: undefined });

    sheet = await openFilters(user);
    expect(within(sheet).getByRole('checkbox', { name: 'Depósito' })).toBeChecked();
    await user.click(within(sheet).getByRole('button', { name: 'Limpiar' }));

    expect(screen.queryByRole('dialog', { name: 'Filtrar movimientos' })).not.toBeInTheDocument();
    expect(await screen.findByText(/Renta de octubre/)).toBeVisible();
    expect(screen.queryByText('Depósito inicial')).not.toBeInTheDocument();
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

  it('WEB-14 WEB-29 el selector de cuenta marca la actual y cambia de cuenta', async () => {
    reads(() => PAGE_1);
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    const group = await screen.findByRole('group', { name: 'Cuenta' });
    expect(within(group).getByRole('button', { name: 'Principal' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(group).getByRole('button', { name: 'Ahorro' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await user.click(within(group).getByRole('button', { name: 'Ahorro' }));
    expect(router.push).toHaveBeenCalledWith(`/accounts/${AHORRO.id}/movements`);
  });

  it('WEB-28 WEB-29 la cuenta abierta queda elegida: la pestaña Movimientos vuelve a ella', async () => {
    bffGetMock.mockImplementation(async (path: string) =>
      path === 'accounts' ? OVERVIEW : PAGE_2,
    );
    const { rerender } = renderWithClient(
      <AccountSelectionProvider>
        <MovementsScreen accountId={AHORRO.id} />
      </AccountSelectionProvider>,
    );
    await screen.findByText('Depósito inicial');

    rerender(
      <AccountSelectionProvider>
        <MovementsIndexScreen />
      </AccountSelectionProvider>,
    );

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(`/accounts/${AHORRO.id}/movements`),
    );
    expect(router.replace).not.toHaveBeenCalledWith(`/accounts/${PRINCIPAL.id}/movements`);
  });

  it('WEB-29 agrupa por día de Ciudad de México: "Hoy", "Ayer" (también a las 05:30 UTC de hoy) y "9 oct"', async () => {
    vi.useFakeTimers({ now: new Date('2026-10-13T18:00:00Z'), toFake: ['Date'] });
    reads(() => ({
      items: [
        movement({ id: 'h', concept: 'Comida', occurredAt: '2026-10-13T16:42:00Z' }),
        movement({ id: 'm', concept: 'Medianoche', occurredAt: '2026-10-13T05:30:00Z' }),
        movement({ id: 'n', concept: 'Nueve', occurredAt: '2026-10-09T18:20:00Z' }),
      ],
      nextCursor: null,
    }));
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    await screen.findByText(/Medianoche/);
    // Los días van a nivel 2, bajo el h1 de AppShell; la tarjeta del estado de cuenta va después
    // del historial (R53).
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Hoy',
      'Ayer',
      '9 oct',
      'Estado de cuenta',
    ]);
    expect(screen.getByText(/Medianoche/).closest('ul')?.previousElementSibling).toHaveTextContent(
      'Ayer',
    );
  });

  it('DSG-17 WEB-29 Escape en una fecha no cierra la hoja; en otro control la cierra y el foco vuelve a "Filtros"', async () => {
    reads(() => PAGE_1);
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    const sheet = await openFilters(user);
    await user.click(within(sheet).getByLabelText('Desde'));
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Filtrar movimientos' })).toBeInTheDocument();
    within(sheet).getByRole('button', { name: 'Aplicar' }).focus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Filtrar movimientos' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filtros' })).toHaveFocus();
  });

  it('DSG-17 con la hoja abierta la página no se desplaza detrás', async () => {
    reads(() => PAGE_1);
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    const sheet = await openFilters(user);
    expect(document.body.style.overflow).toBe('hidden');
    await user.click(within(sheet).getByRole('button', { name: 'Cerrar' }));
    expect(document.body.style.overflow).toBe('');
  });

  it('WEB-20 sin movimientos en el periodo muestra el estado vacío y limpia los filtros', async () => {
    reads(({ from }) => (from ? { items: [], nextCursor: null } : PAGE_2));
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    await screen.findByText('Depósito inicial');

    await applyFilters(user, { from: '2026-01-01' });
    expect(await screen.findByText('No hay movimientos en este periodo')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Limpiar filtros' }));

    expect(await screen.findByText('Depósito inicial')).toBeVisible();
    expect(rows()).toHaveLength(1);
    const sheet = await openFilters(user);
    expect(within(sheet).getByLabelText('Desde')).toHaveValue('');
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

  it('WEB-23 WEB-29 la hoja de filtros abierta no tiene problemas de accesibilidad', async () => {
    reads(() => PAGE_1);
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    await screen.findByText(/Renta de octubre/);
    const sheet = await openFilters(user);
    expect(await axe(sheet)).toHaveNoViolations();
  });
});

describe('MovementsScreen con el estado de cuenta', () => {
  beforeEach(() => {
    bffDownloadMock.mockReset();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T18:00:00.000Z')); // 14 de octubre, 12:00 en CDMX
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('WEB-32 ofrece descargar el estado de cuenta de la cuenta abierta: septiembre 2026 por defecto', async () => {
    reads(() => PAGE_1);
    bffDownloadMock.mockResolvedValue({
      blob: new Blob(['%PDF-'], { type: 'application/pdf' }),
      filename: 'estado-de-cuenta-2026-09-0015.pdf',
    });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: () => 'blob:x' });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);

    expect(screen.getByRole('heading', { name: 'Estado de cuenta' })).toBeVisible();
    expect(screen.getByLabelText('Mes')).toHaveValue('2026-09');
    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(bffDownloadMock).toHaveBeenCalledWith(`accounts/${PRINCIPAL.id}/statements/2026-09`);
  });

  it('WEB-32 con RATE_LIMITED muestra el mensaje con la espera y sigue mostrando los movimientos', async () => {
    reads(() => PAGE_1);
    bffDownloadMock.mockRejectedValue(
      new ProblemError(429, { code: 'RATE_LIMITED', requestId: 'api-7' }, null, 60),
    );
    const user = userEvent.setup();
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    await screen.findByText(/Renta de octubre/);

    await user.click(screen.getByRole('button', { name: 'Descargar PDF' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hiciste demasiados intentos. Espera un momento y vuelve a intentar. Intenta de nuevo en 1 minuto.',
    );
    // El historial agrupado por día vive en la región "Movimientos" (WEB-29).
    expect(screen.getByRole('region', { name: 'Movimientos' })).toBeVisible();
    expect(screen.getByText(/Renta de octubre/)).toBeVisible();
  });

  it('WEB-32 WEB-29 el estado de cuenta va en su propia tarjeta del kit, después del historial', async () => {
    reads(() => PAGE_1);
    renderWithClient(<MovementsScreen accountId={PRINCIPAL.id} />);
    const history = await screen.findByRole('region', { name: 'Movimientos' });
    await screen.findByText(/Renta de octubre/);

    const statement = screen.getByRole('region', { name: 'Estado de cuenta' });
    expect(statement).toHaveClass('rounded-lg', 'bg-surface', 'shadow-card');
    expect(within(statement).getByLabelText('Mes')).toBeInTheDocument();
    expect(within(statement).getByRole('button', { name: 'Descargar PDF' })).toBeInTheDocument();
    expect(
      history.compareDocumentPosition(statement) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});
