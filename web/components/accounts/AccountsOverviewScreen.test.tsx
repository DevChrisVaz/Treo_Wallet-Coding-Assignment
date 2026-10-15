import {
  ProblemError,
  type AccountsOverview,
  type MovementPage,
} from '@devchrisvaz/wallet-contract';
import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { bffGet } from '@/lib/client/bff';
import { queryKeys } from '@/lib/client/query-keys';
import { AHORRO, DAILY_LIMIT, OVERVIEW, PRINCIPAL, movement } from '@/test/fixtures';
import { SessionUserProvider } from '@/lib/client/session-user';
import { renderWithClient } from '@/test/support/render';
import { AccountsOverviewScreen } from './AccountsOverviewScreen';
import { CLIPBOARD_ERROR } from './ReceiveSheet';

vi.mock('@/lib/client/bff', () => ({ bffGet: vi.fn() }));

const bffGetMock = vi.mocked(bffGet);

const LATEST: Record<string, MovementPage> = {
  [PRINCIPAL.id]: {
    items: [movement({ id: 'p1', concept: 'Renta de octubre' })],
    nextCursor: null,
  },
  [AHORRO.id]: {
    items: [movement({ id: 'a1', concept: 'Apartado quincenal' })],
    nextCursor: null,
  },
};

/** Lecturas de Inicio: el resumen y los últimos movimientos de cada cuenta. */
function reads(overview: () => AccountsOverview = () => OVERVIEW) {
  bffGetMock.mockImplementation(async (path: string) => {
    if (path === 'accounts') return overview();
    const latest = LATEST[path.split('/')[1] ?? ''];
    if (latest && path.endsWith('/movements')) return latest;
    throw new Error(`Lectura inesperada: ${path}`);
  });
}

beforeEach(() => {
  bffGetMock.mockReset();
});

describe('AccountsOverviewScreen', () => {
  it('WEB-13 WEB-21 muestra cada cuenta con su nombre, CLABE y saldo con formato es-MX', async () => {
    reads();
    renderWithClient(<AccountsOverviewScreen />);

    const principal = await screen.findByRole('article', { name: 'Principal' });
    expect(within(principal).getByText('$25,000.00')).toBeVisible();
    expect(principal).toHaveTextContent('•••• 9719');
    const ahorro = screen.getByRole('article', { name: 'Ahorro' });
    expect(within(ahorro).getByText('$10,000.00')).toBeVisible();
    expect(bffGetMock).toHaveBeenCalledWith('accounts');
  });

  it('WEB-13 muestra "Te quedan $X hoy" con dailyLimit.remaining', async () => {
    reads();
    renderWithClient(<AccountsOverviewScreen />);
    expect(await screen.findByText('Te quedan $38,000.00 hoy')).toBeVisible();
  });

  it('WEB-13 a medianoche de CDMX muestra el restante que devuelve la API, sin calcularlo', async () => {
    const atMidnight = (remaining: string): AccountsOverview => ({
      ...OVERVIEW,
      dailyLimit: { ...DAILY_LIMIT, used: '50000.00', remaining },
    });
    let current = atMidnight('0.00');
    reads(() => current);
    const { client } = renderWithClient(<AccountsOverviewScreen />);
    expect(await screen.findByText('Te quedan $0.00 hoy')).toBeVisible();

    // A las 00:01 la API ya reinició el límite, aunque "used" siga en 50,000.
    current = atMidnight('50000.00');
    await client.invalidateQueries({ queryKey: queryKeys.accounts });
    expect(await screen.findByText('Te quedan $50,000.00 hoy')).toBeVisible();
  });

  it('WEB-11 tras verificar el correo muestra "Principal" y "Ahorro" en $0.00', async () => {
    reads(() => ({
      accounts: [
        { ...PRINCIPAL, balance: '0.00' },
        { ...AHORRO, balance: '0.00' },
      ],
      dailyLimit: { ...DAILY_LIMIT, used: '0.00', remaining: '50000.00' },
    }));
    renderWithClient(<AccountsOverviewScreen />);
    const principal = await screen.findByRole('article', { name: 'Principal' });
    expect(principal).toHaveTextContent('$0.00');
    expect(screen.getByRole('article', { name: 'Ahorro' })).toHaveTextContent('$0.00');
  });

  // Sustituye a "WEB-14 cada cuenta lleva a su historial y a transferir desde ella": en el rediseño las
  // tarjetas seleccionan (WEB-28) y el hero lleva las acciones de la cuenta elegida.
  it('WEB-28 las acciones rápidas transfieren desde la cuenta elegida y abren sus movimientos', async () => {
    reads();
    renderWithClient(<AccountsOverviewScreen />);
    expect(await screen.findByRole('link', { name: 'Transferir' })).toHaveAttribute(
      'href',
      `/transfers/new?from=${PRINCIPAL.id}`,
    );
    expect(screen.getByRole('link', { name: 'Movimientos' })).toHaveAttribute(
      'href',
      `/accounts/${PRINCIPAL.id}/movements`,
    );
  });

  it('WEB-28 el hero muestra el saldo total sumado sin punto flotante y lo disponible hoy', async () => {
    reads();
    renderWithClient(<AccountsOverviewScreen />);
    expect(await screen.findByTestId('hero-amount')).toHaveTextContent('$35,000.00');
    expect(screen.getByText('Disponible hoy $38,000.00')).toBeVisible();
  });

  it('WEB-28 la primera cuenta queda seleccionada y la lista trae sus últimos 5 movimientos', async () => {
    reads();
    renderWithClient(<AccountsOverviewScreen />);
    expect(await screen.findByRole('button', { name: 'Principal' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await screen.findByText(/Renta de octubre/)).toBeVisible();
    expect(bffGetMock).toHaveBeenCalledWith(`accounts/${PRINCIPAL.id}/movements`, { limit: '5' });
  });

  it('WEB-28 al seleccionar Ahorro la tarjeta queda marcada, la lista muestra los de Ahorro y "Ver todos" abre su historial', async () => {
    reads();
    const user = userEvent.setup();
    renderWithClient(<AccountsOverviewScreen />);

    await user.click(await screen.findByRole('button', { name: 'Ahorro' }));

    expect(screen.getByRole('button', { name: 'Ahorro' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Principal' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(await screen.findByText(/Apartado quincenal/)).toBeVisible();
    expect(bffGetMock).toHaveBeenCalledWith(`accounts/${AHORRO.id}/movements`, { limit: '5' });
    expect(screen.getByRole('link', { name: 'Ver todos' })).toHaveAttribute(
      'href',
      `/accounts/${AHORRO.id}/movements`,
    );
  });

  it('WEB-28 tras una transferencia, invalidar los movimientos (comprobante) vuelve a leer los últimos', async () => {
    reads();
    const { client } = renderWithClient(<AccountsOverviewScreen />);
    await screen.findByText(/Renta de octubre/);
    const latestReads = () =>
      bffGetMock.mock.calls.filter(([path]) => path === `accounts/${PRINCIPAL.id}/movements`);
    expect(latestReads()).toHaveLength(1);

    await client.invalidateQueries({ queryKey: queryKeys.allMovements });

    expect(latestReads()).toHaveLength(2);
  });

  it('WEB-28 el límite diario se muestra una sola vez, sin un encabezado repetido', async () => {
    reads();
    renderWithClient(<AccountsOverviewScreen />);
    await screen.findByText('Te quedan $38,000.00 hoy');
    expect(screen.queryAllByRole('heading', { name: /Límite diario/ }).length).toBeLessThanOrEqual(
      1,
    );
  });

  // Sustituido por WEB-28: la carga muestra el hero, las tarjetas y la lista como esqueletos (dos
  // regiones `status`); la primera anuncia las cuentas.
  it('WEB-20 muestra un estado de carga mientras espera', () => {
    bffGetMock.mockReturnValue(new Promise(() => undefined));
    renderWithClient(<AccountsOverviewScreen />);
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('Cargando tus cuentas');
  });

  it('WEB-20 si la lectura falla muestra el error y "Reintentar" repite la lectura', async () => {
    reads();
    bffGetMock.mockRejectedValueOnce(new ProblemError(500, { code: 'INTERNAL_ERROR' }));
    const user = userEvent.setup();
    renderWithClient(<AccountsOverviewScreen />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar tus cuentas');
    expect(alert).toHaveTextContent(problemMessage('INTERNAL_ERROR'));
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('article', { name: 'Principal' })).toBeVisible();
    expect(bffGetMock.mock.calls.filter(([path]) => path === 'accounts')).toHaveLength(2);
  });

  it('WEB-20 sin cuentas muestra un estado vacío con una acción', async () => {
    reads(() => ({ ...OVERVIEW, accounts: [] }));
    renderWithClient(<AccountsOverviewScreen />);
    expect(await screen.findByRole('heading', { name: 'Aún no tienes cuentas' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Volver a cargar' })).toBeVisible();
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    reads();
    const { container } = renderWithClient(<AccountsOverviewScreen />);
    await screen.findByRole('article', { name: 'Principal' });
    await screen.findByText(/Renta de octubre/);
    expect(await axe(container)).toHaveNoViolations();
  });

  describe('Recibir (WEB-35)', () => {
    function renderHome() {
      reads();
      return renderWithClient(
        <SessionUserProvider user={{ name: 'Ana Gómez Castillo', email: 'ana@example.com' }}>
          <AccountsOverviewScreen />
        </SessionUserProvider>,
      );
    }

    async function openReceive(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole('button', { name: 'Recibir' }));
      return screen.getByRole('dialog', { name: 'Recibir dinero' });
    }

    it('WEB-28 "Recibir" va después de "Transferir" en las acciones rápidas', async () => {
      renderHome();
      await screen.findByRole('button', { name: 'Recibir' });
      const labels = screen
        .getAllByRole('listitem')
        .map((item) => item.textContent)
        .filter((text) => ['Transferir', 'Recibir', 'Movimientos'].includes(text ?? ''));
      expect(labels).toEqual(['Transferir', 'Recibir', 'Movimientos']);
    });

    it('WEB-28 la tarjeta no ofrece "Mostrar CLABE": solo la CLABE enmascarada', async () => {
      renderHome();
      await screen.findByRole('article', { name: 'Principal' });
      expect(screen.queryByRole('button', { name: /Mostrar CLABE|Ocultar CLABE/ })).toBeNull();
      expect(screen.queryByText(PRINCIPAL.clabe)).toBeNull();
    });

    it('WEB-35 abre "Recibir dinero" con la cuenta de Inicio, Titular, Banco, Cuenta y la CLABE agrupada', async () => {
      const user = userEvent.setup();
      renderHome();
      const dialog = await openReceive(user);

      expect(within(dialog).getByRole('radio', { name: 'Principal' })).toBeChecked();
      expect(within(dialog).getByRole('radio', { name: 'Ahorro' })).not.toBeChecked();
      expect(within(dialog).getByText('Ana Gómez Castillo')).toBeVisible();
      expect(within(dialog).getByText('TreoWallet')).toBeVisible();
      expect(within(dialog).getByText('0321 8000 0118 3597 19')).toBeVisible();
      expect(
        within(dialog).getByText(
          'Comparte estos datos para que te transfieran desde otra cuenta TreoWallet.',
        ),
      ).toBeVisible();
    });

    it('WEB-35 preselecciona la cuenta elegida en Inicio', async () => {
      const user = userEvent.setup();
      renderHome();
      await user.click(await screen.findByRole('button', { name: 'Ahorro' }));
      const dialog = await openReceive(user);
      expect(within(dialog).getByRole('radio', { name: 'Ahorro' })).toBeChecked();
      expect(within(dialog).getByText('0321 8000 0118 3597 22')).toBeVisible();
    });

    it('WEB-35 cambiar de cuenta en el selector cambia la cuenta y la CLABE, con las flechas también', async () => {
      const user = userEvent.setup();
      renderHome();
      const dialog = await openReceive(user);

      await user.click(within(dialog).getByRole('radio', { name: 'Ahorro' }));
      expect(within(dialog).getByText('0321 8000 0118 3597 22')).toBeVisible();
      expect(within(dialog).queryByText('0321 8000 0118 3597 19')).toBeNull();

      await user.keyboard('{ArrowLeft}');
      expect(within(dialog).getByRole('radio', { name: 'Principal' })).toBeChecked();
      expect(within(dialog).getByRole('radio', { name: 'Principal' })).toHaveFocus();
      expect(within(dialog).getByText('0321 8000 0118 3597 19')).toBeVisible();
    });

    it('WEB-35 "Copiar CLABE" copia los 18 dígitos sin espacios y muestra "CLABE copiada" anunciada', async () => {
      const user = userEvent.setup();
      renderHome();
      const dialog = await openReceive(user);

      await user.click(within(dialog).getByRole('radio', { name: 'Ahorro' }));
      await user.click(within(dialog).getByRole('button', { name: 'Copiar CLABE' }));

      expect(await navigator.clipboard.readText()).toBe(AHORRO.clabe);
      expect(AHORRO.clabe).toMatch(/^\d{18}$/);
      expect(await within(dialog).findByRole('button', { name: 'CLABE copiada' })).toBeVisible();
      expect(within(dialog).getByRole('status')).toHaveTextContent('CLABE copiada');
    });

    it('WEB-35 "CLABE copiada" vuelve a "Copiar CLABE" a los pocos segundos', async () => {
      const user = userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        renderHome();
        const dialog = await openReceive(user);
        await user.click(within(dialog).getByRole('button', { name: 'Copiar CLABE' }));
        await within(dialog).findByRole('button', { name: 'CLABE copiada' });

        act(() => {
          vi.advanceTimersByTime(3500);
        });
        expect(within(dialog).getByRole('button', { name: 'Copiar CLABE' })).toBeVisible();
      } finally {
        vi.useRealTimers();
      }
    });

    it('WEB-35 si el portapapeles falla avisa y deja la CLABE a la vista', async () => {
      const user = userEvent.setup();
      renderHome();
      vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denegado'));
      const dialog = await openReceive(user);

      await user.click(within(dialog).getByRole('button', { name: 'Copiar CLABE' }));

      expect(await within(dialog).findByRole('alert')).toHaveTextContent(CLIPBOARD_ERROR);
      expect(within(dialog).getByRole('button', { name: 'Copiar CLABE' })).toBeVisible();
      expect(within(dialog).getByText('0321 8000 0118 3597 19')).toBeVisible();
    });

    it('WEB-35 Escape la cierra y al reabrirla vuelve a la cuenta de Inicio', async () => {
      const user = userEvent.setup();
      renderHome();
      const dialog = await openReceive(user);
      await user.click(within(dialog).getByRole('radio', { name: 'Ahorro' }));

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog', { name: 'Recibir dinero' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Recibir' })).toHaveFocus();

      const reopened = await openReceive(user);
      expect(within(reopened).getByRole('radio', { name: 'Principal' })).toBeChecked();
    });

    it('WEB-35 sin la sesión (pantalla sola) omite el Titular en lugar de inventarlo', async () => {
      const user = userEvent.setup();
      reads();
      renderWithClient(<AccountsOverviewScreen />);
      const dialog = await openReceive(user);
      expect(within(dialog).queryByText('Titular')).toBeNull();
      expect(within(dialog).getByText('Banco')).toBeVisible();
    });

    it('WEB-23 la hoja no tiene problemas de accesibilidad', async () => {
      const user = userEvent.setup();
      renderHome();
      const dialog = await openReceive(user);
      expect(await axe(dialog)).toHaveNoViolations();
    });
  });
});
