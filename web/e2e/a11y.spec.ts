import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { PRINCIPAL_ID, SENT_TRANSFER_ID, login, scenario } from './support';

const AXE = readFileSync(join(process.cwd(), 'node_modules/axe-core/axe.min.js'), 'utf8');

/** Violaciones de axe en la página, sin el indicador de desarrollo de Next (`nextjs-portal`). */
async function axe(page: Page): Promise<string[]> {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const runner = (
      window as unknown as {
        axe: {
          run: (context: unknown) => Promise<{
            violations: { id: string; nodes: { target: unknown[] }[] }[];
          }>;
        };
      }
    ).axe;
    const result = await runner.run({ exclude: [['nextjs-portal']] });
    return result.violations.map(
      (violation) =>
        `${violation.id} (${violation.nodes.length}): ${violation.nodes
          .map((node) => JSON.stringify(node.target))
          .join(', ')}`,
    );
  });
}

/*
 * Sin transiciones (globals.css las apaga con movimiento reducido): axe mide los colores finales y no
 * una mezcla a medio camino, como la del botón que queda bajo el mouse tras un clic (150 ms).
 */
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

for (const width of [390, 1280] as const) {
  test(`WEB-23 DSG-14 a ${width} px axe no reporta problemas en ninguna pantalla`, async ({
    page,
  }) => {
    await scenario(page, {});
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      '/login',
      '/register',
      '/verify-email?email=ana%40example.com&registered=1',
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await axe(page), path).toEqual([]);
    }
    await login(page);
    for (const path of [
      '/',
      `/accounts/${PRINCIPAL_ID}/movements`,
      '/beneficiaries',
      '/beneficiaries/new',
      '/transfers/new',
      '/transfers/scheduled',
      `/transfers/${SENT_TRANSFER_ID}`,
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await axe(page), path).toEqual([]);
    }
  });

  test(`WEB-23 DSG-14 a ${width} px axe no reporta problemas en los pasos del flujo ni en las hojas abiertas`, async ({
    page,
  }) => {
    await scenario(page, {});
    await page.setViewportSize({ width, height: 900 });
    await login(page);

    await page.goto(`/accounts/${PRINCIPAL_ID}/movements`);
    await page.getByRole('button', { name: 'Filtros' }).click();
    await expect(page.getByRole('dialog', { name: 'Filtrar movimientos' })).toBeVisible();
    expect(await axe(page), 'hoja de filtros').toEqual([]);
    await page.keyboard.press('Escape');

    if (width < 1024) {
      await page.getByRole('button', { name: 'Menú de la cuenta' }).click();
      await expect(page.getByRole('dialog', { name: 'Tu cuenta' })).toBeVisible();
      expect(await axe(page), 'menú de la cuenta').toEqual([]);
      await page.keyboard.press('Escape');
    }

    await page.goto('/transfers/new');
    await page.getByRole('button', { name: /^Luis/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: '¿Cuánto envías?' })).toBeVisible();
    expect(await axe(page), 'paso de monto').toEqual([]);
    // Con errores a la vista (campos inválidos y sus mensajes).
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByLabel('Monto')).toHaveAttribute('aria-invalid', 'true');
    expect(await axe(page), 'paso de monto con errores').toEqual([]);
    await page.getByLabel('Monto').fill('1250');
    await page.getByLabel('Concepto').fill('Renta');
    await page.getByLabel('Referencia').fill('1');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Revisa tu transferencia' }),
    ).toBeVisible();
    expect(await axe(page), 'revisión').toEqual([]);
    await page.getByRole('button', { name: 'Enviar' }).click();
    await expect(page.getByRole('region', { name: 'Comprobante' })).toBeVisible();
    expect(await axe(page), 'comprobante').toEqual([]);
  });
}
