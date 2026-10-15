import { expect, test, type Page } from '@playwright/test';
import { PRINCIPAL_ID, login, scenario } from './support';

/*
 * Chromium sin interfaz oculta las barras de desplazamiento (`--hide-scrollbars`); aquí se muestran,
 * como en un escritorio con barras clásicas, para medir que abrir la hoja no mueva la página.
 */
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

// Estas pruebas inyectan estilos con `addStyleTag` (ocultar el indicador de Next, escalar el texto),
// que la política de contenido bloquearía. La política se prueba en `security-headers.spec.ts`, sin
// esta excepción.
test.use({ bypassCSP: true });

test.beforeEach(async ({ page }) => {
  await scenario(page, {});
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
});

/** Ancho de la barra de desplazamiento clásica de la página (0 si no ocupa espacio). */
function scrollbarWidth(page: Page): Promise<number> {
  return page.evaluate(() => window.innerWidth - document.documentElement.clientWidth);
}

test('DSG-17 WEB-29 la hoja de filtros atrapa el foco, Escape en una fecha no la cierra y al cerrar vuelve el foco a "Filtros"', async ({
  page,
}) => {
  await page.goto(`/accounts/${PRINCIPAL_ID}/movements`);
  const opener = page.getByRole('button', { name: 'Filtros' });
  await opener.focus();
  await page.keyboard.press('Enter');
  const sheet = page.getByRole('dialog', { name: 'Filtrar movimientos' });
  await expect(sheet).toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  for (let i = 0; i < 15; i += 1) {
    await page.keyboard.press('Tab');
    expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  for (let i = 0; i < 15; i += 1) {
    await page.keyboard.press('Shift+Tab');
    expect(await sheet.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await sheet.getByLabel('Desde').focus();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Aplicar' }).focus();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('DSG-17 WEB-29 con la hoja de filtros abierta la página de fondo no se desplaza', async ({
  page,
}) => {
  // Una ventana baja para que el historial sea más alto que ella.
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto(`/accounts/${PRINCIPAL_ID}/movements`);
  await expect(page.getByRole('region', { name: 'Movimientos' })).toBeVisible();
  const scrollable = await page.evaluate(
    () => document.documentElement.scrollHeight > window.innerHeight + 100,
  );
  expect(scrollable, 'la página debe poder desplazarse para que la prueba sirva').toBe(true);
  await page.getByRole('button', { name: 'Filtros' }).click();
  await expect(page.getByRole('dialog', { name: 'Filtrar movimientos' })).toBeVisible();
  const before = await page.evaluate(() => window.scrollY);
  // La rueda sobre el fondo oscurecido (arriba de la hoja) no mueve la página.
  await page.mouse.move(195, 40);
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await page.keyboard.press('Escape');
  // Ya cerrada, la página vuelve a desplazarse.
  await page.mouse.move(195, 300);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
});

test('DSG-17 WEB-29 en el dashboard abrir la hoja de filtros no mueve la página el ancho de la barra de desplazamiento', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.goto(`/accounts/${PRINCIPAL_ID}/movements`);
  await expect(page.getByRole('region', { name: 'Movimientos' })).toBeVisible();
  const scrollbar = await scrollbarWidth(page);
  expect(scrollbar, 'la página debe tener una barra de desplazamiento clásica').toBeGreaterThan(0);
  const opener = page.getByRole('button', { name: 'Filtros' });
  const title = page.getByRole('heading', { level: 1, name: 'Movimientos' });
  const place = async () => ({
    filtros: (await opener.boundingBox())?.x,
    title: (await title.boundingBox())?.x,
    width: (await page.getByRole('main').boundingBox())?.width,
  });
  const closed = await place();
  await opener.click();
  await expect(page.getByRole('dialog', { name: 'Filtrar movimientos' })).toBeVisible();
  // Sin la barra (overflow: hidden) el cuerpo compensa su ancho con relleno a la derecha.
  expect(await scrollbarWidth(page)).toBe(0);
  expect(await page.evaluate(() => document.body.style.paddingRight)).toBe(`${scrollbar}px`);
  expect(await place()).toEqual(closed);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Filtrar movimientos' })).toBeHidden();
  expect(await page.evaluate(() => document.body.style.paddingRight)).toBe('');
  expect(await place()).toEqual(closed);
});

test('DSG-17 WEB-27 el menú de la cuenta se cierra con Escape y devuelve el foco al avatar', async ({
  page,
}) => {
  const avatar = page.getByRole('button', { name: 'Menú de la cuenta' });
  // Las iniciales se ven (las dibuja CSS) sin ser texto del botón, que se nombra con su etiqueta.
  const initials = avatar.locator('[data-initials]');
  expect(await initials.evaluate((el) => getComputedStyle(el, '::before').content)).toBe('"AG"');
  expect(await avatar.evaluate((el) => el.textContent)).toBe('');
  await avatar.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Tu cuenta' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Tu cuenta' })).toBeHidden();
  await expect(avatar).toBeFocused();
});

test('WEB-28 DSG-17 a 320 px con el texto al 200 % el diálogo de cancelar una programada cabe en la pantalla y sus botones se alcanzan', async ({
  page,
}) => {
  const height = 568;
  await page.setViewportSize({ width: 320, height });
  await page.goto('/transfers/scheduled');
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const opener = page.getByRole('button', { name: /^Cancelar la transferencia de/ });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: '¿Cancelar la transferencia programada?' });
  await expect(dialog).toBeVisible();
  // Como la hoja del kit: hasta 85 % del alto, dentro de la pantalla; lo que no cabe se desplaza.
  const box = await dialog.boundingBox();
  expect(box).toBeTruthy();
  if (!box) return;
  expect(box.y).toBeGreaterThanOrEqual(-0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(height + 0.5);
  expect(box.height).toBeLessThanOrEqual(height * 0.85 + 1);
  for (const name of ['Cancelar transferencia', 'Volver']) {
    const button = dialog.getByRole('button', { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport();
  }
  await dialog.getByRole('button', { name: 'Volver', exact: true }).focus();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});
