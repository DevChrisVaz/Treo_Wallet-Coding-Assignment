import { act, screen, userEvent } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { createFakeApi, json, problem, type FakeApi, type FakeReply } from '@/test-utils/fake-api';
import { luis, overview } from '@/test-utils/fixtures';
import { renderApp } from '@/test-utils/render-app';
import { pendingOtp, transfer } from '@/test-utils/transfer-fixtures';
import { theme } from '@/theme';

import { TransferFlowScreen } from '../transfer-flow-screen';

function apiWith(...createReplies: FakeReply[]): FakeApi {
  return createFakeApi()
    .on('GET', '/accounts', json(200, overview()))
    .on('GET', '/beneficiaries', json(200, { items: [luis] }))
    .on('POST', '/transfers', ...createReplies);
}

const routes = {
  index: () => <Text>Pantalla de inicio</Text>,
  'transfer/index': () => <Text>Elegir destinatario</Text>,
  'transfer/send': TransferFlowScreen,
};

async function open(fake: FakeApi, fakeTimers = false) {
  const rendered = await renderApp({
    fake,
    routes,
    initialUrl: `/transfer/send?beneficiaryId=${luis.id}`,
  });
  const user = userEvent.setup(fakeTimers ? { advanceTimers: jest.advanceTimersByTime } : {});
  return { ...rendered, user };
}

type Instance = ReturnType<typeof screen.getByText>;

/** Separación del contenedor más cercano que apila a los dos elementos (su ancestro común con `gap`). */
function stackGap(first: Instance, second: Instance): unknown {
  const ancestors = new Set<Instance>();
  for (let node: Instance | null = first; node; node = node.parent) ancestors.add(node);
  for (let node: Instance | null = second; node; node = node.parent) {
    if (!ancestors.has(node)) continue;
    const props = node.props as { style?: unknown; contentContainerStyle?: unknown };
    const gap = (
      StyleSheet.flatten(props.style ?? props.contentContainerStyle) as { gap?: unknown }
    )?.gap;
    if (gap !== undefined) return gap;
  }
  return undefined;
}

async function review(user: ReturnType<typeof userEvent.setup>, amount: string) {
  await user.type(await screen.findByLabelText('Monto'), amount);
  await user.type(screen.getByLabelText('Concepto'), 'Renta');
  await user.type(screen.getByLabelText('Referencia (opcional)'), '1');
  await user.press(screen.getByRole('button', { name: 'Continuar' }));
}

describe('flujo por pasos', () => {
  afterEach(() => jest.useRealTimers());

  test('MOB-21 el monto es el protagonista del paso de monto, debajo de a quién se envía', async () => {
    await open(apiWith(json(201, transfer())));
    // El encabezado del paso ya se ve mientras cargan los datos: se espera a quién se envía.
    expect(await screen.findByText('Para')).toBeOnTheScreen();
    expect(screen.getByLabelText('Paso 2 de 5: Monto')).toBeOnTheScreen();
    expect(screen.getByText('Luis · CLABE •••• 5678')).toBeOnTheScreen();
    expect(screen.getByTestId('hero-amount-mirror', { includeHiddenElements: true })).toBeTruthy();
  });

  test('MOB-21 los campos del paso de monto van a la distancia de las secciones de la pantalla, como en la historia aprobada', async () => {
    await open(apiWith(json(201, transfer())));
    const amount = await screen.findByLabelText('Monto');
    const concept = screen.getByLabelText('Concepto');
    const reference = screen.getByLabelText('Referencia (opcional)');
    // La pantalla separa sus secciones con spacing[5]; el formulario no agrega otra pila más apretada.
    expect(stackGap(concept, reference)).toBe(theme.spacing[5]);
    expect(stackGap(amount, concept)).toBe(theme.spacing[5]);
    expect(stackGap(screen.getByText('Para'), amount)).toBe(theme.spacing[5]);
  });

  test('MOB-21 en el paso de código el indicador muestra el paso 4 de 5 y lo anuncia', async () => {
    const { user } = await open(apiWith(json(201, pendingOtp())));
    await review(user, '15000');
    expect(await screen.findByLabelText('Paso 3 de 5: Revisión')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Enviar' }));
    const stepper = await screen.findByLabelText('Paso 4 de 5: Código');
    expect(stepper).toHaveProp('accessibilityLiveRegion', 'polite');
  });

  test('MOB-21 al perder la red al enviar reintenta con la misma llave y muestra el estado de reintento', async () => {
    jest.useFakeTimers();
    const fake = apiWith('network-error', json(201, transfer()));
    const { user } = await open(fake, true);
    await review(user, '1250');
    await user.press(await screen.findByRole('button', { name: 'Enviar' }));
    expect(
      await screen.findByText('Perdimos la conexión. Reintentaremos la misma operación (1 de 5).'),
    ).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Enviando tu transferencia' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1500);
    });
    expect(await screen.findByText('Completada')).toBeOnTheScreen();
    const keys = fake
      .requestsTo('POST', '/transfers')
      .map((request) => request.headers['idempotency-key']);
    expect(keys).toHaveLength(2);
    expect(keys[1]).toBe(keys[0]);
  });

  test('MOB-21 MOB-13 el comprobante lleva el origen con su terminación y ofrece hacer otra transferencia', async () => {
    const { user, router } = await open(apiWith(json(201, transfer())));
    await review(user, '1250');
    await user.press(await screen.findByRole('button', { name: 'Enviar' }));
    expect(await screen.findByText('Principal · •••• 9719')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Hacer otra transferencia' }));
    expect(await screen.findByText('Elegir destinatario')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/transfer');
  });

  test('MOB-21 salir de la transferencia vuelve a Inicio', async () => {
    const { user, router } = await open(apiWith(json(201, transfer())));
    await user.press(await screen.findByRole('button', { name: 'Salir de la transferencia' }));
    expect(await screen.findByText('Pantalla de inicio')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/');
  });

  test('MOB-21 MOB-12 la falla es el último paso: lleva su título y el comprobante con el origen', async () => {
    const fake = apiWith(json(201, pendingOtp())).on(
      'POST',
      `/transfers/${pendingOtp().id}/confirm`,
      problem(422, 'OTP_ATTEMPTS_EXHAUSTED', { transferId: pendingOtp().id }),
    );
    const { user } = await open(fake);
    await review(user, '15000');
    await user.press(await screen.findByRole('button', { name: 'Enviar' }));
    await user.type(await screen.findByLabelText('Código de 6 dígitos'), '000000');
    await user.press(screen.getByRole('button', { name: 'Confirmar' }));

    expect(
      await screen.findByRole('header', { name: 'La transferencia no se realizó' }),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText('Paso 5 de 5: Comprobante')).toBeOnTheScreen();
    expect(
      screen.getByText('Agotaste los intentos. Cancelamos la transferencia.'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Fallida')).toBeOnTheScreen();
    expect(screen.getByText('Principal · •••• 9719')).toBeOnTheScreen();
  });

  test('MOB-21 si no cargan las cuentas, el error lo dice y permite reintentar', async () => {
    const fake = createFakeApi()
      .on('GET', '/accounts', problem(500, 'INTERNAL_ERROR'), json(200, overview()))
      .on('GET', '/beneficiaries', json(200, { items: [luis] }));
    const { user } = await open(fake);

    expect(
      await screen.findByText('No pudimos cargar tus cuentas y beneficiarios'),
    ).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByLabelText('Monto')).toBeOnTheScreen();
    expect(fake.requestsTo('GET', '/accounts')).toHaveLength(2);
  });
});
