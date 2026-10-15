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
