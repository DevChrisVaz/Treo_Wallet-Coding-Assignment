import { expect, test } from '@playwright/test';
import { login, scenario } from './support';

/*
 * Transferencias programadas en un navegador real (WEB-33, WEB-34): programar desde el flujo y
 * cancelar desde "Programadas" con la API simulada, que acepta `scheduledFor` y la cancelación.
 */

for (const width of [390, 1280] as const) {
  test(`WEB-34 WEB-23 a ${width} px al cancelar una programada sale de la lista, se anuncia y el foco va al h1 visible`, async ({
    page,
  }) => {
    await scenario(page, {});
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await page.goto('/transfers/scheduled');

    await page.getByRole('button', { name: /^Cancelar la transferencia de/ }).click();
    const dialog = page.getByRole('dialog', { name: '¿Cancelar la transferencia programada?' });
    await dialog.getByRole('button', { name: 'Cancelar transferencia', exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole('status').filter({ hasText: 'Transferencia cancelada' }),
    ).toBeVisible();
    await expect(page.getByText('No tienes transferencias programadas')).toBeVisible();
    // El botón que abrió el diálogo ya no existe: el foco queda en el título que se ve en esta forma.
    const focused = page.locator(':focus');
    await expect(focused).toHaveRole('heading');
    await expect(focused).toHaveText('Transferencias programadas');
    expect(await focused.evaluate((element) => element.checkVisibility())).toBe(true);
  });

  test(`WEB-33 a ${width} px programar una transferencia llega a "Transferencia programada" con su fecha`, async ({
    page,
  }) => {
    await scenario(page, {});
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await page.goto('/transfers/new');
    await page.getByRole('button', { name: /^Luis/ }).click();

    await page.getByLabel('Monto').fill('1000');
    await page.getByLabel('Concepto').fill('Renta');
    await page.getByLabel('Referencia').fill('1');
    await page.getByLabel('Programar').check();
    await page.getByLabel('Fecha de envío').fill('2026-10-20');
    await page.getByRole('button', { name: 'Continuar' }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Revisa tu transferencia' }),
    ).toBeVisible();
    await expect(
      page.locator('main').getByText('Se enviará el 20 de octubre de 2026').first(),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Enviar' }).click();

    await expect(
      page.getByRole('heading', { level: 1, name: 'Transferencia programada' }),
    ).toBeVisible();
    const receipt = page.getByRole('region', { name: 'Comprobante' });
    await expect(receipt.getByText('Programada', { exact: true })).toBeVisible();
    // Etiqueta y valor por separado: no dependen de que el texto de ambos quede pegado.
    await expect(receipt.getByText('Programada para', { exact: true })).toBeVisible();
    await expect(receipt.getByText('20 de octubre de 2026', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'tus transferencias programadas' })).toBeVisible();
  });
}

test('WEB-34 si la programada ya no se puede cancelar, lo explica y la lista se vuelve a cargar sin ella', async ({
  page,
}) => {
  await scenario(page, { cancel: 'gone' });
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/transfers/scheduled');

  await page.getByRole('button', { name: /^Cancelar la transferencia de/ }).click();
  await page.getByRole('button', { name: 'Cancelar transferencia', exact: true }).click();

  // En `main`: el anunciador de rutas de Next también es `role="alert"`.
  const alert = page.locator('main').getByRole('alert');
  await expect(alert).toHaveText('Esta transferencia ya no se puede cancelar.');
  await expect(alert).toBeFocused();
  await expect(page.getByText('No tienes transferencias programadas')).toBeVisible();
});
