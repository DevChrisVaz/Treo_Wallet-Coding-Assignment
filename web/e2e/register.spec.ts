import { expect, test } from '@playwright/test';
import { apiRequests, scenario } from './support';

// CURP válida de una persona nacida el 21 de noviembre de 1985 en la Ciudad de México (DF).
const CURP = 'SEPB851121HDFRRL08';

test('WEB-11 una fecha y una entidad distintas de la CURP se marcan en su campo y no se envía el registro', async ({
  page,
}) => {
  await scenario(page, {});
  await page.goto('/register');
  await page.getByLabel('CURP').fill(CURP);
  await page.getByLabel('Fecha de nacimiento').fill('1985-11-22');
  const state = page.getByLabel('Entidad de nacimiento');
  await state.focus();
  await state.selectOption('JC');
  await state.blur();

  await expect(page.getByText('La fecha no coincide con tu CURP')).toBeVisible();
  await expect(page.getByText('La entidad no coincide con tu CURP')).toBeVisible();
  const registers = (await apiRequests(page)).filter((r) => r.path === '/auth/register');
  expect(registers).toHaveLength(0);
});

test('WEB-11 un registro en revisión lo dice al verificar, no inicia la sesión y ofrece volver al inicio de sesión', async ({
  page,
}) => {
  await scenario(page, { registration: 'in-review' });
  await page.goto('/verify-email?email=ana%40example.com');
  await page.getByLabel('Código de 6 dígitos').fill('123456');
  await page.getByRole('button', { name: 'Verificar correo' }).click();

  await expect(
    page.getByText('Tu registro está en revisión. Te escribiremos a tu correo cuando terminemos.'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/verify-email/);
  await page.getByRole('link', { name: 'Ir a iniciar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('WEB-12 un registro en revisión que inicia sesión ve el mensaje y se queda en el inicio de sesión', async ({
  page,
}) => {
  await scenario(page, { registration: 'in-review' });
  await page.goto('/login');
  await page.getByLabel('Correo').fill('ana@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('contraseña-segura1');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();

  await expect(
    page.getByText('Tu registro está en revisión. Te escribiremos a tu correo cuando terminemos.'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
