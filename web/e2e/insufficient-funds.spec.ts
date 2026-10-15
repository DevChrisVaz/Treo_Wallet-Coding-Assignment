import { expect, test } from '@playwright/test';
import { login, scenario } from './support';

/*
 * Saldo insuficiente en un navegador real (WEB-16, WEB-17): la API simulada rechaza con 422
 * INSUFFICIENT_FUNDS el monto 30,000; la revisión avisa, muestra el saldo disponible y deja corregir.
 */

for (const width of [390, 1280] as const) {
  test(`WEB-17 a ${width} px una transferencia sin saldo muestra "Saldo insuficiente" y permite corregir`, async ({
    page,
  }) => {
    await scenario(page, {});
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await page.goto('/transfers/new');

    await page.getByRole('button', { name: /^Luis/ }).click();
    await page.getByLabel('Monto').fill('30000');
    await page.getByLabel('Concepto').fill('Prueba');
    await page.getByLabel('Referencia').fill('1');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Enviar' }).click();

    const alert = page.getByRole('alert').filter({ hasText: 'Saldo insuficiente' });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Saldo disponible en');
    await expect(page.getByRole('region', { name: 'Comprobante' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Corregir' }).click();
    await expect(page.getByLabel('Monto')).toBeVisible();
  });
}
