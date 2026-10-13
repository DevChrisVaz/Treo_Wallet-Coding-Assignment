import { ProblemError, type AccountsOverview } from '@devchrisvaz/wallet-contract';
import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { bffGet } from '@/lib/client/bff';
import { queryKeys } from '@/lib/client/query-keys';
import { AHORRO, DAILY_LIMIT, OVERVIEW, PRINCIPAL } from '@/test/fixtures';
import { renderWithClient } from '@/test/support/render';
import { AccountsOverviewScreen } from './AccountsOverviewScreen';

vi.mock('@/lib/client/bff', () => ({ bffGet: vi.fn() }));

const bffGetMock = vi.mocked(bffGet);

beforeEach(() => {
  bffGetMock.mockReset();
});

describe('AccountsOverviewScreen', () => {
  it('WEB-13 WEB-21 muestra cada cuenta con su nombre, CLABE y saldo con formato es-MX', async () => {
    bffGetMock.mockResolvedValue(OVERVIEW);
    renderWithClient(<AccountsOverviewScreen />);

    const principal = await screen.findByRole('article', { name: 'Principal' });
    expect(within(principal).getByText('$25,000.00')).toBeVisible();
    expect(principal).toHaveTextContent('•••• 9719');
    const ahorro = screen.getByRole('article', { name: 'Ahorro' });
    expect(within(ahorro).getByText('$10,000.00')).toBeVisible();
    expect(bffGetMock).toHaveBeenCalledWith('accounts');
  });

  it('WEB-13 muestra "Te quedan $X hoy" con dailyLimit.remaining', async () => {
    bffGetMock.mockResolvedValue(OVERVIEW);
    renderWithClient(<AccountsOverviewScreen />);
    expect(await screen.findByText('Te quedan $38,000.00 hoy')).toBeVisible();
  });

  it('WEB-13 a medianoche de CDMX muestra el restante que devuelve la API, sin calcularlo', async () => {
    const atMidnight = (remaining: string): AccountsOverview => ({
      ...OVERVIEW,
      dailyLimit: { ...DAILY_LIMIT, used: '50000.00', remaining },
    });
    bffGetMock.mockResolvedValueOnce(atMidnight('0.00'));
    const { client } = renderWithClient(<AccountsOverviewScreen />);
    expect(await screen.findByText('Te quedan $0.00 hoy')).toBeVisible();

    // A las 00:01 la API ya reinició el límite, aunque "used" siga en 50,000.
    bffGetMock.mockResolvedValueOnce(atMidnight('50000.00'));
    await client.invalidateQueries({ queryKey: queryKeys.accounts });
    expect(await screen.findByText('Te quedan $50,000.00 hoy')).toBeVisible();
  });

  it('WEB-11 tras verificar el correo muestra "Principal" y "Ahorro" en $0.00', async () => {
    bffGetMock.mockResolvedValue({
      accounts: [
        { ...PRINCIPAL, balance: '0.00' },
        { ...AHORRO, balance: '0.00' },
      ],
      dailyLimit: { ...DAILY_LIMIT, used: '0.00', remaining: '50000.00' },
    });
    renderWithClient(<AccountsOverviewScreen />);
    const principal = await screen.findByRole('article', { name: 'Principal' });
    expect(principal).toHaveTextContent('$0.00');
    expect(screen.getByRole('article', { name: 'Ahorro' })).toHaveTextContent('$0.00');
  });

  it('WEB-14 cada cuenta lleva a su historial y a transferir desde ella', async () => {
    bffGetMock.mockResolvedValue(OVERVIEW);
    renderWithClient(<AccountsOverviewScreen />);
    expect(
      await screen.findByRole('link', { name: 'Ver movimientos de Principal' }),
    ).toHaveAttribute('href', `/accounts/${PRINCIPAL.id}/movements`);
    expect(screen.getByRole('link', { name: 'Transferir desde Principal' })).toHaveAttribute(
      'href',
      `/transfers/new?from=${PRINCIPAL.id}`,
    );
  });

  it('WEB-20 muestra un estado de carga mientras espera', () => {
    bffGetMock.mockReturnValue(new Promise(() => undefined));
    renderWithClient(<AccountsOverviewScreen />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando tus cuentas');
  });

  it('WEB-20 si la lectura falla muestra el error y "Reintentar" repite la lectura', async () => {
    bffGetMock.mockRejectedValueOnce(new ProblemError(500, { code: 'INTERNAL_ERROR' }));
    bffGetMock.mockResolvedValueOnce(OVERVIEW);
    const user = userEvent.setup();
    renderWithClient(<AccountsOverviewScreen />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No pudimos cargar tus cuentas');
    expect(alert).toHaveTextContent(problemMessage('INTERNAL_ERROR'));
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));

    expect(await screen.findByRole('article', { name: 'Principal' })).toBeVisible();
    expect(bffGetMock).toHaveBeenCalledTimes(2);
  });

  it('WEB-20 sin cuentas muestra un estado vacío con una acción', async () => {
    bffGetMock.mockResolvedValue({ ...OVERVIEW, accounts: [] });
    renderWithClient(<AccountsOverviewScreen />);
    expect(await screen.findByRole('heading', { name: 'Aún no tienes cuentas' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Volver a cargar' })).toBeVisible();
  });

  it('WEB-23 no tiene problemas de accesibilidad', async () => {
    bffGetMock.mockResolvedValue(OVERVIEW);
    const { container } = renderWithClient(<AccountsOverviewScreen />);
    await screen.findByRole('article', { name: 'Principal' });
    expect(await axe(container)).toHaveNoViolations();
  });
});
