import { expect, test } from '@playwright/test';
import { PRIVATE_PATHS, PUBLIC_PATHS, hasHorizontalScroll, login, scenario } from './support';

/*
 * Chromium sin interfaz oculta las barras de desplazamiento (`--hide-scrollbars`); aquí se muestran,
 * como en un escritorio con barras clásicas que ocupan ancho: algo medido con `100vw` (que incluye
 * la barra) desbordaría la página aunque sin barras no se note.
 */
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });

for (const width of [1280, 1920] as const) {
  test(`WEB-24 a ${width} px con barras de desplazamiento clásicas ninguna pantalla se desplaza a lo ancho`, async ({
    page,
  }) => {
    await scenario(page, {});
    // Una ventana baja para que las páginas tengan barra vertical.
    await page.setViewportSize({ width, height: 600 });
    const check = async (path: string) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await hasHorizontalScroll(page), `${path} a ${width} px`).toBe(false);
    };
    for (const path of PUBLIC_PATHS) await check(path);
    await login(page);
    for (const path of PRIVATE_PATHS) await check(path);
    // La prueba solo sirve si la barra ocupa ancho: en Inicio debe haberla.
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const scrollbar = await page.evaluate(
      () => window.innerWidth - document.documentElement.clientWidth,
    );
    expect(scrollbar).toBeGreaterThan(0);
  });
}
