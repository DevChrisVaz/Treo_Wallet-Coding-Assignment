import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { CONNECTION_ERROR } from '@/lib/client/problem-messages';
import { PRINCIPAL } from '@/test/fixtures';
import { deferred, problemResponse } from '@/test/support/fake-api';
import { PERIOD_BEFORE_CREATION, StatementDownload } from './StatementDownload';

/** Cuenta abierta hace más de un año: ofrece los 13 meses de siempre. */
const CREATED_AT = '2025-10-03T15:00:00.000Z';
const FILENAME = 'estado-de-cuenta-2026-09-0015.pdf';
const PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x33, 0xff]);

function pdfResponse() {
  return new Response(PDF_BYTES, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${FILENAME}"`,
    },
  });
}

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>();
const createObjectURL = vi.fn<(blob: Blob) => string>();
const revokeObjectURL = vi.fn<(url: string) => void>();
let saved: { href: string; download: string }[];

beforeEach(() => {
  // Solo el reloj: los temporizadores siguen siendo reales para user-event.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T18:00:00.000Z')); // 14 de octubre, 12:00 en CDMX
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  createObjectURL.mockReset().mockReturnValue('blob:estado-de-cuenta');
  revokeObjectURL.mockReset();
  // jsdom no implementa los object URLs ni la navegación de un <a download>.
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL });
  saved = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push({ href: this.href, download: this.download });
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const button = () => screen.getByRole('button', { name: 'Descargar PDF' });

describe('StatementDownload', () => {
  it('WEB-32 con `now` (lienzos con el reloj fijo) los meses salen de esa fecha y no del reloj', () => {
    // El reloj dice mayo de 2024, como en la captura de design-sync; la fecha de la historia manda.
    vi.setSystemTime(new Date('2024-05-15T12:00:00.000Z'));
    render(
      <StatementDownload
        accountId={PRINCIPAL.id}
        createdAt={CREATED_AT}
        now={new Date('2026-10-13T18:00:00.000Z')}
      />,
    );
    const select = screen.getByLabelText<HTMLSelectElement>('Mes');
    const options = within(select).getAllByRole('option');
    expect(options[0]).toHaveTextContent('octubre 2026 (en curso)');
    expect(options.at(-1)).toHaveTextContent('octubre 2025');
    expect(select).toHaveValue('2026-09');
  });

  it('WEB-32 el 14 de octubre de 2026 ofrece "octubre 2026 (en curso)" y de octubre de 2025 a septiembre de 2026, con septiembre seleccionado', () => {
    render(<StatementDownload accountId={PRINCIPAL.id} createdAt={CREATED_AT} />);
    const select = screen.getByLabelText<HTMLSelectElement>('Mes');
    const options = within(select)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toEqual([
      'octubre 2026 (en curso)',
      'septiembre 2026',
      'agosto 2026',
      'julio 2026',
      'junio 2026',
      'mayo 2026',
      'abril 2026',
      'marzo 2026',
      'febrero 2026',
      'enero 2026',
      'diciembre 2025',
      'noviembre 2025',
      'octubre 2025',
    ]);
    expect(select.value).toBe('2026-09');
    expect(screen.getByRole('option', { name: 'septiembre 2026', selected: true })).toBeTruthy();
  });

  it('WEB-32 "Descargar PDF" pide septiembre 2026 al BFF y guarda el PDF con el nombre de Content-Disposition', async () => {
    fetchMock.mockResolvedValue(pdfResponse());
    const user = userEvent.setup();
    render(<StatementDownload accountId={PRINCIPAL.id} createdAt={CREATED_AT} />);

    await user.click(button());

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `/bff/api/accounts/${PRINCIPAL.id}/statements/2026-09`,
    );
    expect(saved[0]).toEqual({ href: 'blob:estado-de-cuenta', download: FILENAME });
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob?.type).toBe('application/pdf');
    expect(new Uint8Array(await (blob as Blob).arrayBuffer())).toEqual(PDF_BYTES);
    expect(document.querySelector('a[download]')).toBeNull();
  });

  it('WEB-32 descarga el mes elegido en el selector', async () => {
    fetchMock.mockResolvedValue(pdfResponse());
    const user = userEvent.setup();
    render(<StatementDownload accountId={PRINCIPAL.id} createdAt={CREATED_AT} />);

    await user.selectOptions(screen.getByLabelText('Mes'), 'octubre 2026 (en curso)');
    await user.click(button());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `/bff/api/accounts/${PRINCIPAL.id}/statements/2026-10`,
    );
  });

  it('WEB-32 con doble clic el BFF recibe una sola petición y el botón se muestra ocupado', async () => {
    const response = deferred<Response>();
    fetchMock.mockReturnValue(response.promise);
    const user = userEvent.setup();
    render(<StatementDownload accountId={PRINCIPAL.id} createdAt={CREATED_AT} />);
    const download = button();

    await user.dblClick(download);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(download).toBeDisabled();
    expect(download).toHaveAttribute('aria-busy', 'true');
    expect(download).toHaveTextContent('Descargando…');

    response.resolve(pdfResponse());
    await waitFor(() => expect(download).toBeEnabled());
    expect(download).not.toHaveAttribute('aria-busy');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(saved).toHaveLength(1);
  });

  it('WEB-32 con 429 RATE_LIMITED y Retry-After: 60 muestra el mensaje con la espera y no descarga nada', async () => {
    fetchMock.mockResolvedValue(
      problemResponse(429, { code: 'RATE_LIMITED', requestId: 'api-9' }, { 'Retry-After': '60' }),
    );
    const user = userEvent.setup();
    render(<StatementDownload accountId={PRINCIPAL.id} createdAt={CREATED_AT} />);

    await user.click(button());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      'Hiciste demasiados intentos. Espera un momento y vuelve a intentar. Intenta de nuevo en 1 minuto.',
    );
    expect(alert).toHaveFocus();
    expect(saved).toEqual([]);
    expect(button()).toBeEnabled();
  });

  it('WEB-32 un fallo de red muestra el mensaje de conexión y una descarga correcta lo quita', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    fetchMock.mockResolvedValueOnce(pdfResponse());
    const user = userEvent.setup();
    render(<StatementDownload accountId={PRINCIPAL.id} createdAt={CREATED_AT} />);

    await user.click(button());
    expect(await screen.findByRole('alert')).toHaveTextContent(CONNECTION_ERROR);

    await user.click(button());
    await waitFor(() => expect(saved).toHaveLength(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('WEB-32 una cuenta creada en agosto de 2026 ofrece de octubre a agosto, con septiembre seleccionado', () => {
    render(<StatementDownload accountId={PRINCIPAL.id} createdAt="2026-08-20T15:00:00.000Z" />);
    const select = screen.getByLabelText<HTMLSelectElement>('Mes');
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['octubre 2026 (en curso)', 'septiembre 2026', 'agosto 2026']);
    expect(select.value).toBe('2026-09');
  });

  it('WEB-32 una cuenta creada este mes ofrece solo el mes en curso, seleccionado', () => {
    render(<StatementDownload accountId={PRINCIPAL.id} createdAt="2026-10-02T15:00:00.000Z" />);
    const select = screen.getByLabelText<HTMLSelectElement>('Mes');
    expect(within(select).getAllByRole('option')).toHaveLength(1);
    expect(select.value).toBe('2026-10');
  });

  it('WEB-32 un 422 en /period muestra un mensaje claro y no descarga nada', async () => {
    fetchMock.mockResolvedValue(
      problemResponse(422, {
        code: 'VALIDATION_FAILED',
        requestId: 'api-3',
        errors: [{ pointer: '/period', code: 'DATE_OUT_OF_RANGE', message: 'Fuera de rango' }],
      }),
    );
    const user = userEvent.setup();
    render(<StatementDownload accountId={PRINCIPAL.id} createdAt={CREATED_AT} />);

    await user.click(button());

    expect(await screen.findByRole('alert')).toHaveTextContent(PERIOD_BEFORE_CREATION);
    expect(saved).toEqual([]);
  });

  it('WEB-23 el selector tiene etiqueta y axe no reporta problemas, tampoco con el error a la vista', async () => {
    fetchMock.mockResolvedValue(problemResponse(404, { code: 'NOT_FOUND', requestId: 'api-1' }));
    const user = userEvent.setup();
    const { container } = render(
      <StatementDownload accountId={PRINCIPAL.id} createdAt={CREATED_AT} />,
    );
    expect(await axe(container)).toHaveNoViolations();

    await user.click(button());
    expect(await screen.findByRole('alert')).toHaveTextContent('No encontramos lo que buscas.');
    expect(await axe(container)).toHaveNoViolations();
  });
});
