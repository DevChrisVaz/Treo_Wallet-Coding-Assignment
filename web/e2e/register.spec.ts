import { expect, test } from '@playwright/test';
import { apiRequests, scenario } from './support';

// La CURP y el teléfono que la API simulada ya tiene en otra cuenta (`TAKEN` en fake-api.mjs).
const TAKEN = { curp: 'SEPB851121HDFRRL08', rfc: 'SEPB851121SD2', phone: '5520000042' };

test('WEB-11 una CURP y un teléfono de otra cuenta se marcan en su campo y el registro no pasa a la verificación', async ({
  page,
}) => {
  await scenario(page, {});
  await page.goto('/register');
  await page.getByLabel('Correo').fill('ana@example.com');
  await page.getByLabel('Contraseña', { exact: true }).fill('contraseña-segura1');
  await page.getByLabel('Confirmar contraseña').fill('contraseña-segura1');
  await page.getByLabel('Nombre completo').fill('Beatriz Sepúlveda Romero');
  await page.getByLabel('CURP').fill(TAKEN.curp);
  await page.getByLabel('RFC').fill(TAKEN.rfc);
  await page.getByLabel('Teléfono').fill(TAKEN.phone);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();

  await expect(page.getByText('Esta CURP ya está registrada en otra cuenta.')).toBeVisible();
  await expect(page.getByText('Este RFC ya está registrado en otra cuenta.')).toBeVisible();
  await expect(page.getByText('Este teléfono ya está registrado en otra cuenta.')).toBeVisible();
  await expect(page.getByLabel('CURP')).toBeFocused();
  await expect(page).toHaveURL(/\/register$/);
  const registers = (await apiRequests(page)).filter((r) => r.path === '/auth/register');
  expect(registers).toHaveLength(1);
});
