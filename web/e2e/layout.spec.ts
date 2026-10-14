import { expect, test, type Page } from '@playwright/test';
import {
  PRINCIPAL_ID,
  SENT_TRANSFER_ID,
  apiRequests,
  hasHorizontalScroll,
  login,
  scenario,
  visibleH1Count,
} from './support';

const WIDTHS = [320, 390, 768, 1024, 1440, 1920] as const;
const PUBLIC = ['/login', '/register', '/verify-email?email=ana%40example.com&registered=1'];
const PRIVATE = [
  '/',
  `/accounts/${PRINCIPAL_ID}/movements`,
  '/beneficiaries',
  '/beneficiaries/new',
  '/transfers/new',
  `/transfers/${SENT_TRANSFER_ID}`,
];

test.beforeEach(async ({ page }) => {
  await scenario(page, {});
});

for (const width of WIDTHS) {
  test(`WEB-24 WEB-23 a ${width} px ninguna pantalla se desplaza a lo ancho, cada una tiene un solo h1 visible, un solo main y un solo "Saltar al contenido"`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const check = async (path: string) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await hasHorizontalScroll(page), `${path} a ${width} px`).toBe(false);
      expect(await visibleH1Count(page), `${path} a ${width} px`).toBe(1);
      await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toHaveCount(1);
      // Un solo `main` en el DOM (no solo en el árbol de accesibilidad) y es el destino del salto.
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.getByRole('main')).toHaveAttribute('id', 'contenido');
    };
    for (const path of PUBLIC) await check(path);
    await login(page);
    for (const path of PRIVATE) await check(path);
  });
}

test('WEB-24 WEB-27 a 390 px se ve la forma de app con pestañas abajo y a 1280 px el dashboard', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const nav = page.getByRole('navigation', { name: 'Principal' });
  await expect(nav).toHaveCount(1);
  const box = await nav.boundingBox();
  expect(Math.round((box?.y ?? 0) + (box?.height ?? 0))).toBe(844);
  await expect(nav.getByRole('link')).toHaveCount(4);
  await expect(page.getByRole('heading', { level: 1, name: 'Hola, Ana' })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('complementary')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: 'Inicio' })).toBeVisible();
});

test('WEB-27 en el flujo de transferencia a 390 px no hay pestañas', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/transfers/new');
  await expect(page.getByRole('heading', { level: 1, name: '¿A quién le envías?' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Principal' })).toHaveCount(0);
});

test('WEB-28 Inicio pide los últimos 5 movimientos por el BFF y el `limit=5` llega a la API', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  const latest = page.getByRole('region', { name: 'Últimos movimientos' });
  await expect(latest.getByRole('listitem')).toHaveCount(5);
  const reads = (await apiRequests(page)).filter(
    (request) => request.method === 'GET' && request.path === `/accounts/${PRINCIPAL_ID}/movements`,
  );
  expect(reads.map((request) => request.search)).toEqual(['?limit=5']);
});

/** Renglones del monto del hero: el texto de cada línea que pinta el navegador. */
function heroLines(page: Page): Promise<string[]> {
  return page.getByTestId('hero-amount').evaluate((element) => {
    const visible = element.querySelector('[aria-hidden="true"]');
    const walker = document.createTreeWalker(visible ?? element, NodeFilter.SHOW_TEXT);
    // Un carácter es del renglón cuyo alto contiene su centro (los centavos, más chicos, comparten
    // renglón con los pesos aunque su caja empiece más abajo).
    const lines: { top: number; bottom: number; text: string }[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? '';
      for (let index = 0; index < text.length; index += 1) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        const { top, bottom } = range.getBoundingClientRect();
        const center = (top + bottom) / 2;
        const line = lines.find((item) => center >= item.top && center <= item.bottom);
        if (line) line.text += text[index];
        else lines.push({ top, bottom, text: text[index] ?? '' });
      }
    }
    return lines.sort((a, b) => a.top - b.top).map((line) => line.text);
  });
}

for (const width of [320, 390, 1280] as const) {
  test(`WEB-28 a ${width} px con el texto al 200 % el saldo del hero no se corta ni se recorta con puntos suspensivos`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await login(page);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    const amount = page.getByTestId('hero-amount');
    await expect(amount).toBeVisible();
    const fit = await amount.evaluate((element) => {
      const hero = element.closest('section');
      const box = element.getBoundingClientRect();
      const heroBox = hero?.getBoundingClientRect();
      return {
        overflowX: element.scrollWidth <= element.clientWidth + 1,
        overflowY: element.scrollHeight <= element.clientHeight + 1,
        ellipsis: getComputedStyle(element).textOverflow === 'ellipsis',
        // El hero tiene `overflow-hidden`: el monto debe quedar entero dentro de él.
        inside:
          heroBox !== undefined &&
          box.left >= heroBox.left - 1 &&
          box.right <= heroBox.right + 1 &&
          box.bottom <= heroBox.bottom + 1,
      };
    });
    expect(fit).toEqual({ overflowX: true, overflowY: true, ellipsis: false, inside: true });
    expect(await hasHorizontalScroll(page)).toBe(false);
    // Lo que se ve (para el reporte): en qué punto pasa de línea el monto.
    const lines = await heroLines(page);
    test.info().annotations.push({ type: 'renglones del hero', description: lines.join(' ⏎ ') });
    console.log(`hero a ${width} px con texto al 200 %: ${JSON.stringify(lines)}`);
    expect(lines.join('')).toBe('$35,000.00');
  });
}

for (const width of WIDTHS) {
  test(`WEB-26 R44 a ${width} px Beneficiarios muestra un solo "Agregar beneficiario"`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    await page.goto('/beneficiaries');
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Luis Pérez Ramírez' }),
    ).toBeVisible();
    const add = page.getByRole('link', { name: 'Agregar beneficiario' });
    await expect(add).toHaveCount(1);
    await expect(add).toBeVisible();
    // En el dashboard es la acción de la barra superior; en la forma de app, el enlace del contenido.
    const inTopBar = page.getByRole('banner').getByRole('link', { name: 'Agregar beneficiario' });
    await expect(inTopBar).toHaveCount(width >= 1024 ? 1 : 0);
  });
}

/**
 * Lo más bajo del contenido del paso: sus hojas (elementos sin hijos o con texto propio), sin el pie
 * fijo ni su espaciador. Los contenedores no cuentan: el espaciador los estira hasta debajo del pie.
 */
function contentBottom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return Number.POSITIVE_INFINITY;
    const outsideContent = (element: Element) => {
      for (let node: Element | null = element; node && node !== main; node = node.parentElement) {
        if (getComputedStyle(node).position === 'fixed') return true;
        if (node.getAttribute('aria-hidden') === 'true') return true;
      }
      return false;
    };
    const isLeaf = (element: Element) =>
      element.children.length === 0 ||
      [...element.childNodes].some(
        (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
      );
    let bottom = 0;
    for (const element of main.querySelectorAll('*')) {
      if (!isLeaf(element) || !element.checkVisibility() || outsideContent(element)) continue;
      bottom = Math.max(bottom, element.getBoundingClientRect().bottom);
    }
    return bottom;
  });
}

/** Borde superior del pie fijo que contiene el botón `name`. */
function footerTop(page: Page, name: string): Promise<number> {
  return page.getByRole('button', { name }).evaluate((button) => {
    for (let node: Element | null = button; node; node = node.parentElement) {
      if (getComputedStyle(node).position === 'fixed') return node.getBoundingClientRect().top;
    }
    return Number.NaN;
  });
}

test('WEB-30 a 390 px el pie fijo de cada paso no tapa el contenido (el espaciador reserva su alto)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto('/transfers/new');
  await page.getByRole('button', { name: /^Luis/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '¿Cuánto envías?' })).toBeVisible();
  // Una ventana más baja que cada paso: sin el espaciador, lo último quedaría debajo del pie.
  await page.setViewportSize({ width: 390, height: 480 });

  const atBottom = async (button: string) => {
    const tall = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight,
    );
    expect(tall, `el paso de "${button}" debe ser más alto que la ventana`).toBe(true);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const top = await footerTop(page, button);
    const bottom = await contentBottom(page);
    expect(bottom, `contenido bajo el pie de "${button}"`).toBeLessThanOrEqual(top + 0.5);
  };

  await atBottom('Continuar');
  await page.getByLabel('Monto').fill('1250');
  await page.getByLabel('Concepto').fill('Renta');
  await page.getByLabel('Referencia').fill('1');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Revisa tu transferencia' }),
  ).toBeVisible();
  await atBottom('Enviar');
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByRole('region', { name: 'Comprobante' })).toBeVisible();
  await atBottom('Hacer otra transferencia');
});

test('WEB-30 a 1280 px el resumen va en su columna a la derecha del paso y sigue lo que se escribe', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await login(page);
  await page.goto('/transfers/new');
  await page.getByRole('button', { name: /^Luis/ }).click();
  const step = page.getByRole('region', { name: '¿Cuánto envías?' });
  const summary = page.getByRole('region', { name: 'Resumen' });
  await expect(summary).toBeVisible();
  const stepBox = await step.boundingBox();
  const summaryBox = await summary.boundingBox();
  expect(stepBox && summaryBox).toBeTruthy();
  if (!stepBox || !summaryBox) return;
  expect(summaryBox.x).toBeGreaterThanOrEqual(stepBox.x + stepBox.width);
  expect(Math.round(summaryBox.width)).toBe(320);
  // Mismo renglón: el resumen arranca a la altura del paso.
  expect(Math.abs(summaryBox.y - stepBox.y)).toBeLessThan(1);
  await page.getByLabel('Monto').fill('1250');
  await expect(summary.getByText('$1,250.00')).toBeVisible();
  await expect(summary.getByText('Luis', { exact: false })).toBeVisible();

  // En la forma de app no hay resumen lateral.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('region', { name: 'Resumen' })).toHaveCount(0);
});
