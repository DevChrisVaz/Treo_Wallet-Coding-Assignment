import { screen, userEvent } from '@testing-library/react-native';

import { createFakeApi, json, type FakeApi } from '@/test-utils/fake-api';
import { luis, mama, overview, principal } from '@/test-utils/fixtures';
import { renderApp } from '@/test-utils/render-app';
import { transfer } from '@/test-utils/transfer-fixtures';

import { TransferFlowScreen } from '../transfer-flow-screen';

function apiWithData(): FakeApi {
  return createFakeApi()
    .on('GET', '/accounts', json(200, overview()))
    .on('GET', '/beneficiaries', json(200, { items: [luis, mama] }))
    .on('POST', '/transfers', json(201, transfer()));
}

async function openForm(fake: FakeApi) {
  await renderApp({
    fake,
    routes: { 'transfer/send': TransferFlowScreen },
    initialUrl: `/transfer/send?beneficiaryId=${luis.id}`,
  });
  await screen.findByText('Luis · CLABE •••• 5678');
  return userEvent.setup();
}

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  {
    amount,
    concept = 'Renta',
    reference = '1',
  }: { amount: string; concept?: string; reference?: string },
) {
  await user.type(screen.getByLabelText('Monto'), amount);
  await user.type(screen.getByLabelText('Concepto'), concept);
  await user.type(screen.getByLabelText('Referencia'), reference);
  await user.press(screen.getByRole('button', { name: 'Continuar' }));
}

describe('captura de la transferencia', () => {
  test('MOB-08 un monto con más de 2 decimales se rechaza junto al campo, sin redondear ni enviar', async () => {
    const fake = apiWithData();
    const user = await openForm(fake);

    await fill(user, { amount: '100.005' });

    expect(screen.getByText('El monto admite máximo 2 decimales')).toBeOnTheScreen();
    expect(screen.getByLabelText('Monto')).toHaveProp(
      'accessibilityHint',
      'El monto admite máximo 2 decimales',
    );
    expect(screen.getByLabelText('Monto')).toHaveDisplayValue('100.005');
    expect(screen.queryByText('$100.01')).toBeNull();
    expect(fake.requestsTo('POST', '/transfers')).toHaveLength(0);
  });

  test('MOB-08 un monto sin centavos se acepta y viaja como el string "1250"', async () => {
    const fake = apiWithData();
    const user = await openForm(fake);

    await fill(user, { amount: '1250' });
    await user.press(await screen.findByRole('button', { name: 'Enviar' }));

    const [request] = fake.requestsTo('POST', '/transfers');
    expect(request?.body).toBe(
      JSON.stringify({
        fromAccountId: principal.id,
        destination: { type: 'BENEFICIARY', beneficiaryId: luis.id },
        amount: '1250',
        concept: 'Renta',
        reference: '1',
      }),
    );
    expect(request?.headers['content-type']).toMatch(/application\/json/);
  });

  test('MOB-08 un monto de cero indica que debe ser mayor que 0', async () => {
    const fake = apiWithData();
    const user = await openForm(fake);
    await fill(user, { amount: '0.00' });
    expect(screen.getByText('El monto debe ser mayor que 0')).toBeOnTheScreen();
    expect(fake.requestsTo('POST', '/transfers')).toHaveLength(0);
  });

  test('MOB-08 una referencia no numérica indica que solo admite dígitos', async () => {
    const fake = apiWithData();
    const user = await openForm(fake);
    await fill(user, { amount: '100', reference: '12A45' });
    expect(screen.getByText('La referencia solo admite dígitos')).toBeOnTheScreen();
    expect(fake.requestsTo('POST', '/transfers')).toHaveLength(0);
  });

  test('MOB-08 el concepto no puede empezar ni terminar con espacios', async () => {
    const fake = apiWithData();
    const user = await openForm(fake);
    await fill(user, { amount: '100', concept: ' Renta' });
    expect(
      screen.getByText('El concepto no puede empezar ni terminar con espacios'),
    ).toBeOnTheScreen();
  });

  test('MOB-08 se puede elegir otra cuenta de origen', async () => {
    const fake = apiWithData();
    const user = await openForm(fake);

    expect(screen.getByRole('button', { name: /^Cuenta de origen: Principal/ })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: /^Cuenta de origen/ }));
    await user.press(screen.getByRole('button', { name: /^Ahorro/ }));
    await fill(user, { amount: '10' });
    await user.press(await screen.findByRole('button', { name: 'Enviar' }));

    const [request] = fake.requestsTo('POST', '/transfers');
    expect(JSON.parse(request?.body ?? '')).toMatchObject({
      fromAccountId: overview().accounts[1]?.id,
    });
  });
});
