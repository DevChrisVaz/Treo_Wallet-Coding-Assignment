import { problemMessage } from '@devchrisvaz/wallet-design-tokens';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmTransfer, createTransfer, resendTransferOtp } from '@/app/actions/transfers';
import { bffGet } from '@/lib/client/bff';
import { queryKeys } from '@/lib/client/query-keys';
import {
  AHORRO,
  BENEFICIARY,
  OVERVIEW,
  PRINCIPAL,
  pendingOtpTransfer,
  problem,
  transfer,
} from '@/test/fixtures';
import { router, setLocation } from '@/test/support/next-navigation';
import { renderWithClient, testQueryClient } from '@/test/support/render';
import { fillTransfer, mockTransferReads } from '@/test/support/transfer-flow';
import { TransferFlow } from './TransferFlow';

vi.mock('@/app/actions/transfers', () => ({
  createTransfer: vi.fn(),
  confirmTransfer: vi.fn(),
  resendTransferOtp: vi.fn(),
}));
vi.mock('@/lib/client/bff', () => ({ bffGet: vi.fn() }));
vi.mock('next/navigation', () => import('@/test/support/next-navigation'));

const createMock = vi.mocked(createTransfer);
const confirmMock = vi.mocked(confirmTransfer);
const resendMock = vi.mocked(resendTransferOtp);
const bffGetMock = vi.mocked(bffGet);

function accountReads(): number {
  return bffGetMock.mock.calls.filter(([path]) => path === 'accounts').length;
}

beforeEach(() => {
  createMock.mockReset();
  confirmMock.mockReset();
  resendMock.mockReset();
  bffGetMock.mockReset();
  mockTransferReads(bffGetMock);
  setLocation('/transfers/new');
});

describe('TransferFlow · flujo completo', () => {
  it('WEB-16 WEB-17 WEB-18 formulario → confirmación → OTP → comprobante', async () => {
    const pending = pendingOtpTransfer();
    const completed = transfer({ amount: '15000.00', requiresOtp: true });
    createMock.mockResolvedValue({ ok: true, data: { transfer: pending, replayed: false } });
    confirmMock
      .mockResolvedValueOnce({
        ok: false,
        problem: problem('OTP_INVALID', { attemptsRemaining: 2 }),
      })
      .mockResolvedValueOnce({ ok: true, data: completed });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />, {
      client: testQueryClient(),
    });

    // Formulario
    await fillTransfer(user, '15,000');

    // Confirmación
    const summary = await screen.findByRole('region', { name: 'Revisa tu transferencia' });
    expect(summary).toHaveTextContent('$15,000.00');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({ amount: '15000' });

    // OTP: primero un código incorrecto, luego el correcto
    expect(await screen.findByRole('heading', { name: 'Confirma con tu código' })).toHaveFocus();
    expect(
      screen.getByText('Te enviamos un código de 6 dígitos a an***@example.com.'),
    ).toBeVisible();
    expect(screen.getByText('Vence a las 10:52.')).toBeVisible();
    const code = screen.getByLabelText('Código de 6 dígitos');
    await user.type(code, '000000');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Te quedan 2 intentos');
    await user.clear(code);
    await user.type(code, '123456');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    // Comprobante
    const receipt = await screen.findByRole('region', { name: 'Comprobante' });
    expect(within(receipt).getByText('Completada')).toBeVisible();
    expect(receipt).toHaveTextContent('$15,000.00');
    expect(receipt).toHaveTextContent(completed.id);
    expect(confirmMock).toHaveBeenLastCalledWith({ transferId: pending.id, otp: '123456' });
    expect(createMock).toHaveBeenCalledTimes(1);
    // Se vuelven a consultar las cuentas para mostrar el saldo nuevo.
    await waitFor(() => expect(accountReads()).toBeGreaterThanOrEqual(2));
  });

  it('WEB-16 una transferencia sin OTP muestra el comprobante y vuelve a consultar las cuentas', async () => {
    createMock.mockResolvedValue({ ok: true, data: { transfer: transfer(), replayed: false } });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);

    await fillTransfer(user, '5,000');
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));

    expect(await screen.findByRole('heading', { name: 'Transferencia enviada' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'Comprobante' })).toHaveTextContent('$5,000.00');
    expect(confirmMock).not.toHaveBeenCalled();
    await waitFor(() => expect(accountReads()).toBeGreaterThanOrEqual(2));
  });

  it('WEB-16 WEB-17 saldo insuficiente: se anuncia con el saldo disponible y al corregir se envía un intento nuevo', async () => {
    createMock
      .mockResolvedValueOnce({
        ok: false,
        problem: problem('INSUFFICIENT_FUNDS', { transferId: transfer().id }),
      })
      .mockResolvedValueOnce({ ok: true, data: { transfer: transfer(), replayed: false } });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);

    await fillTransfer(user, '30,000');
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveFocus();
    expect(within(alert).getByText('Saldo insuficiente')).toBeVisible();
    expect(alert).toHaveTextContent(problemMessage('INSUFFICIENT_FUNDS'));
    expect(alert).toHaveTextContent('Saldo disponible en Principal: $25,000.00');

    await user.click(screen.getByRole('button', { name: 'Corregir' }));
    const amount = screen.getByLabelText('Monto');
    await user.clear(amount);
    await user.type(amount, '5,000');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));

    expect(await screen.findByRole('region', { name: 'Comprobante' })).toHaveTextContent(
      '$5,000.00',
    );
    const [first, second] = createMock.mock.calls;
    expect(first?.[0]).toMatchObject({ amount: '30000' });
    expect(second?.[0]).toMatchObject({ amount: '5000' });
    expect(second?.[1]).not.toBe(first?.[1]);
  });

  it('WEB-30 WEB-18 al agotar los intentos muestra el comprobante fallido y ofrece intentar de nuevo', async () => {
    createMock.mockResolvedValue({
      ok: true,
      data: { transfer: pendingOtpTransfer(), replayed: false },
    });
    confirmMock.mockResolvedValue({ ok: false, problem: problem('OTP_ATTEMPTS_EXHAUSTED') });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);

    await fillTransfer(user, '15,000');
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));
    await user.type(await screen.findByLabelText('Código de 6 dígitos'), '000000');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      problemMessage('OTP_ATTEMPTS_EXHAUSTED'),
    );
    expect(
      within(screen.getByRole('region', { name: 'Comprobante' })).getByText('Fallida'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Intentar de nuevo' }));
    // Reiniciar vuelve al primer paso; el monto del intento nuevo empieza vacío.
    expect(
      await screen.findByRole('heading', { level: 1, name: '¿A quién le envías?' }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: /^Luis/ }));
    expect(screen.getByLabelText('Monto')).toHaveValue('');
  });

  it('WEB-30 el indicador muestra el paso 3 de 5 en la revisión de una transferencia con código y lo anuncia', async () => {
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    expect(await screen.findByText('Paso 1 de 5 · Destinatario')).toHaveAttribute(
      'aria-live',
      'polite',
    );
    await fillTransfer(user, '15,000');
    expect(await screen.findByText('Paso 3 de 5 · Revisión')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('WEB-30 sin código la revisión es el paso 3 de 4 y el comprobante el 4 de 4', async () => {
    createMock.mockResolvedValue({ ok: true, data: { transfer: transfer(), replayed: false } });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user);
    expect(await screen.findByText('Paso 3 de 4 · Revisión')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Paso 4 de 4 · Comprobante')).toBeVisible();
  });

  it('WEB-30 elegir la cuenta de Ahorro continúa como traspaso entre cuentas propias sin pedir beneficiario', async () => {
    createMock.mockResolvedValue({ ok: true, data: { transfer: transfer(), replayed: false } });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await user.click(await screen.findByRole('button', { name: /^Ahorro/ }));
    expect(screen.queryByLabelText('Beneficiario')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Monto'), '200');
    await user.type(screen.getByLabelText('Concepto'), 'Apartado');
    await user.type(screen.getByLabelText('Referencia'), '42');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      fromAccountId: PRINCIPAL.id,
      destination: { type: 'OWN_ACCOUNT', accountId: AHORRO.id },
      amount: '200',
    });
  });

  it('WEB-30 WEB-16 desde la pestaña Transferir, elegir Principal deja Ahorro como origen (R38)', async () => {
    createMock.mockResolvedValue({ ok: true, data: { transfer: transfer(), replayed: false } });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await user.click(await screen.findByRole('button', { name: /^Principal/ }));
    const origin = screen.getByLabelText('Cuenta de origen');
    expect(origin).toHaveValue(AHORRO.id);
    expect(
      within(origin)
        .getAllByRole('option')
        .some((option) => option.textContent?.startsWith('Principal')),
    ).toBe(false);
    await user.type(screen.getByLabelText('Monto'), '300');
    await user.type(screen.getByLabelText('Concepto'), 'Regreso');
    await user.type(screen.getByLabelText('Referencia'), '7');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      fromAccountId: AHORRO.id,
      destination: { type: 'OWN_ACCOUNT', accountId: PRINCIPAL.id },
      amount: '300',
    });
  });

  it('WEB-30 con el beneficiario del acceso directo empieza en el monto', async () => {
    const user = userEvent.setup();
    renderWithClient(<TransferFlow defaultBeneficiaryId={BENEFICIARY.id} />);
    expect(await screen.findByRole('heading', { level: 1, name: '¿Cuánto envías?' })).toBeVisible();
    // El título ya es el del monto mientras carga (fix round 1); el destinatario llega con los datos.
    expect(await screen.findByText('Luis · CLABE •••• 9735')).toBeVisible();
    await user.type(screen.getByLabelText('Monto'), '10');
  });

  it('WEB-22 si la sesión terminó al enviar, lleva al inicio de sesión con el regreso al flujo', async () => {
    createMock.mockResolvedValue({
      ok: false,
      problem: problem('UNAUTHENTICATED', { status: 401 }),
    });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user);
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/login?next=%2Ftransfers%2Fnew&reason=expired'),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('WEB-30 en el dashboard el resumen acompaña cada paso con lo capturado', async () => {
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    const summary = await screen.findByRole('region', { name: 'Resumen' });
    expect(summary).toHaveTextContent('Principal · •••• 9719');
    expect(summary).toHaveTextContent('Por definir');
    expect(summary).toHaveTextContent('Te quedan $38,000.00 de tu límite diario de hoy.');
    await user.click(screen.getByRole('button', { name: /^Luis/ }));
    await user.type(await screen.findByLabelText('Monto'), '15,000');
    const updated = screen.getByRole('region', { name: 'Resumen' });
    expect(updated).toHaveTextContent('Luis · •••• 9735');
    expect(updated).toHaveTextContent('$15,000.00');
    expect(updated).toHaveTextContent('Como el monto es mayor a $10,000.00');
  });

  it('WEB-20 si la relectura de las cuentas falla después del comprobante, el comprobante sigue a la vista', async () => {
    createMock.mockResolvedValue({ ok: true, data: { transfer: transfer(), replayed: false } });
    let accountsRead = 0;
    bffGetMock.mockImplementation(async (path: string) => {
      if (path === 'beneficiaries') return { items: [BENEFICIARY] };
      if (path !== 'accounts') throw new Error(`Lectura inesperada: ${path}`);
      accountsRead += 1;
      if (accountsRead > 1) throw new TypeError('Failed to fetch');
      return OVERVIEW;
    });
    const user = userEvent.setup();
    const { client } = renderWithClient(<TransferFlow />);
    await fillTransfer(user);
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));
    expect(await screen.findByRole('region', { name: 'Comprobante' })).toBeVisible();

    // El comprobante pide releer las cuentas; esa relectura falla.
    await waitFor(() => expect(client.getQueryState(queryKeys.accounts)?.status).toBe('error'));

    expect(screen.getByRole('region', { name: 'Comprobante' })).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: 'Transferencia enviada' })).toBeVisible();
    expect(
      screen.queryByText('No pudimos cargar tus cuentas y beneficiarios'),
    ).not.toBeInTheDocument();
  });

  it('WEB-23 al agotar los intentos la alerta recibe el foco, no el título del paso', async () => {
    createMock.mockResolvedValue({
      ok: true,
      data: { transfer: pendingOtpTransfer(), replayed: false },
    });
    confirmMock.mockResolvedValue({ ok: false, problem: problem('OTP_ATTEMPTS_EXHAUSTED') });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await fillTransfer(user, '15,000');
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));
    await user.type(await screen.findByLabelText('Código de 6 dígitos'), '000000');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveFocus();
    expect(
      screen.getByRole('heading', { level: 1, name: 'La transferencia no se realizó' }),
    ).not.toHaveFocus();
  });

  it('WEB-30 con el beneficiario del acceso directo, mientras carga ya indica el paso 2 de 5', () => {
    bffGetMock.mockImplementation(() => new Promise(() => undefined));
    renderWithClient(<TransferFlow defaultBeneficiaryId={BENEFICIARY.id} />);
    expect(screen.getByText('Cargando tus cuentas y beneficiarios')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: '¿Cuánto envías?' })).toBeVisible();
    expect(screen.getByText('Paso 2 de 5 · Monto')).toBeVisible();
  });
});

describe('TransferFlow · programar', () => {
  // 14 de octubre de 2026, 12:00 en la Ciudad de México.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T18:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('WEB-33 programar 1000.00 a Luis el 20 de octubre: la revisión lo dice y el resultado es "Transferencia programada" con la insignia, la fecha y el enlace', async () => {
    const scheduled = transfer({
      status: 'SCHEDULED',
      amount: '1000.00',
      scheduledFor: '2026-10-20',
      completedAt: null,
    });
    createMock.mockResolvedValue({ ok: true, data: { transfer: scheduled, replayed: false } });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);

    await fillTransfer(user, '1,000', '2026-10-20');
    expect(
      await screen.findByRole('region', { name: 'Revisa tu transferencia' }),
    ).toHaveTextContent('Se enviará el 20 de octubre de 2026');
    await user.click(screen.getByRole('button', { name: 'Enviar' }));

    const heading = await screen.findByRole('heading', { name: 'Transferencia programada' });
    expect(heading).toHaveFocus();
    expect(
      screen.queryByRole('heading', { name: 'Transferencia enviada' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Se enviará el 20 de octubre de 2026\./)).toBeVisible();
    expect(screen.getByRole('link', { name: 'tus transferencias programadas' })).toHaveAttribute(
      'href',
      '/transfers/scheduled',
    );
    const receipt = screen.getByRole('region', { name: 'Comprobante' });
    expect(within(receipt).getByText('Programada')).toBeVisible();
    expect(receipt).toHaveTextContent('$1,000.00');
    expect(receipt).toHaveTextContent('Programada para20 de octubre de 2026');
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({ scheduledFor: '2026-10-20' });
  });

  it('WEB-33 WEB-30 en el dashboard el resumen dice cuándo se enviará, desde el monto hasta la revisión', async () => {
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);
    await user.click(await screen.findByRole('button', { name: /^Luis/ }));
    await user.type(await screen.findByLabelText('Monto'), '1,000');
    expect(screen.getByRole('region', { name: 'Resumen' })).not.toHaveTextContent('Cuándo');

    await user.click(screen.getByRole('radio', { name: 'Programar' }));
    await user.type(screen.getByLabelText('Fecha de envío'), '2026-10-20');
    expect(screen.getByRole('region', { name: 'Resumen' })).toHaveTextContent(
      'CuándoSe enviará el 20 de octubre de 2026',
    );

    await user.type(screen.getByLabelText('Concepto'), 'Renta');
    await user.type(screen.getByLabelText('Referencia'), '1');
    await user.click(screen.getByRole('button', { name: 'Continuar' }));
    await screen.findByRole('region', { name: 'Revisa tu transferencia' });
    expect(screen.getByRole('region', { name: 'Resumen' })).toHaveTextContent(
      'CuándoSe enviará el 20 de octubre de 2026',
    );
  });

  it('WEB-33 WEB-18 programada mayor al umbral: tras el código correcto muestra "Transferencia programada" y no "Transferencia enviada"', async () => {
    const pending = pendingOtpTransfer({ scheduledFor: '2026-10-20' });
    const scheduled = transfer({
      status: 'SCHEDULED',
      amount: '15000.00',
      requiresOtp: true,
      scheduledFor: '2026-10-20',
      completedAt: null,
    });
    createMock.mockResolvedValue({ ok: true, data: { transfer: pending, replayed: false } });
    confirmMock.mockResolvedValue({ ok: true, data: scheduled });
    const user = userEvent.setup();
    renderWithClient(<TransferFlow />);

    await fillTransfer(user, '15,000', '2026-10-20');
    await user.click(await screen.findByRole('button', { name: 'Enviar' }));
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({
      amount: '15000',
      scheduledFor: '2026-10-20',
    });

    await user.type(await screen.findByLabelText('Código de 6 dígitos'), '123456');
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByRole('heading', { name: 'Transferencia programada' })).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Transferencia enviada' }),
    ).not.toBeInTheDocument();
    const receipt = screen.getByRole('region', { name: 'Comprobante' });
    expect(within(receipt).getByText('Programada')).toBeVisible();
    expect(receipt).toHaveTextContent('Programada para20 de octubre de 2026');
  });
});
