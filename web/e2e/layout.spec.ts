import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  PRINCIPAL_ID,
  PRIVATE_PATHS,
  PUBLIC_PATHS,
  apiRequests,
  hasHorizontalScroll,
  login,
  scenario,
  visibleH1Count,
} from './support';

const WIDTHS = [320, 390, 768, 1024, 1440, 1920] as const;
/** El indicador de desarrollo de Next tapa la esquina inferior izquierda; no es de la app. */
const HIDE_DEV_INDICATOR = 'nextjs-portal { display: none !important; }';

// Estas pruebas inyectan estilos con `addStyleTag` (ocultar el indicador de Next, escalar el texto),
// que la política de contenido bloquearía. La política se prueba en `security-headers.spec.ts`, sin
// esta excepción.
test.use({ bypassCSP: true });

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
      // Contados en el DOM (no por rol): un segundo enlace oculto también sería un error.
      const skip = page.locator('a[href="#contenido"]');
      await expect(skip).toHaveCount(1);
      await expect(skip).toHaveText('Saltar al contenido');
      // Un solo `main` en el DOM (no solo en el árbol de accesibilidad) y es el destino del salto.
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.getByRole('main')).toHaveAttribute('id', 'contenido');
    };
    for (const path of PUBLIC_PATHS) await check(path);
    await login(page);
    for (const path of PRIVATE_PATHS) await check(path);
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

/**
 * Renglones de un texto tal como los pinta el navegador. Un carácter es del renglón cuyo alto
 * contiene su centro (los centavos, más chicos, comparten renglón con los pesos).
 */
function renderedLines(target: Locator): Promise<string[]> {
  return target.evaluate((element) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
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

/** Cada corte entre renglones cae tras un separador de miles o antes de los centavos. */
function breaksBetweenGroups(lines: string[]): boolean {
  return lines.every(
    (line, index) =>
      index === lines.length - 1 || line.endsWith(',') || (lines[index + 1] ?? '').startsWith('.'),
  );
}

/** Todos los caracteres de `target` se pintan dentro de `box` (ninguno recortado) y de la ventana. */
function glyphsInside(target: Locator, box: Locator): Promise<boolean> {
  return box.elementHandle().then((handle) =>
    target.evaluate((element, container) => {
      const limit = (container as Element).getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(element);
      return [...range.getClientRects()].every(
        (rect) =>
          rect.left >= limit.left - 0.5 &&
          rect.right <= limit.right + 0.5 &&
          rect.top >= limit.top - 0.5 &&
          rect.bottom <= limit.bottom + 0.5 &&
          rect.right <= document.documentElement.clientWidth + 0.5,
      );
    }, handle),
  );
}

for (const width of [320, 390, 1280] as const) {
  test(`WEB-28 a ${width} px con el texto al 200 % el saldo del hero y el de la tarjeta no se cortan ni se parten entre dígitos`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await login(page);
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    const amount = page.getByTestId('hero-amount');
    await expect(amount).toBeVisible();
    const hero = page.getByRole('region', { name: 'Saldo total' });
    const visible = amount.locator('[aria-hidden="true"]');
    // El hero tiene `overflow-hidden`: cada carácter del monto debe pintarse dentro de él.
    expect(await glyphsInside(visible, hero)).toBe(true);
    expect(await amount.evaluate((el) => getComputedStyle(el).textOverflow)).not.toBe('ellipsis');
    // Los lectores de pantalla leen el monto entero, sin los cortes visuales.
    await expect(amount.locator('.sr-only')).toHaveText('$35,000.00');
    expect(await hasHorizontalScroll(page)).toBe(false);
    const heroLines = await renderedLines(visible);
    expect(heroLines.join('')).toBe('$35,000.00');
    expect(breaksBetweenGroups(heroLines), JSON.stringify(heroLines)).toBe(true);

    const card = page.getByRole('article', { name: 'Principal' });
    const balance = card.getByText('$25,000.00', { exact: true });
    expect(await glyphsInside(balance, card)).toBe(true);
    const cardLines = await renderedLines(balance);
    expect(cardLines.join('')).toBe('$25,000.00');
    expect(breaksBetweenGroups(cardLines), JSON.stringify(cardLines)).toBe(true);

    // Lo que se ve (para el reporte): en qué punto pasa de línea cada monto.
    const seen = `hero ${JSON.stringify(heroLines)}, tarjeta ${JSON.stringify(cardLines)}`;
    test.info().annotations.push({ type: 'renglones de los montos', description: seen });
    console.log(`montos a ${width} px con texto al 200 %: ${seen}`);
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

/**
 * Con la página desplazada hasta el final: distancia entre el borde inferior de lo último del
 * contenido y el borde superior de lo fijo de abajo que contiene a `fixed`. Lo último es el último
 * hijo de `main` (pestañas) o lo que va antes del espaciador del pie (paso del flujo), que
 * `StepActions` marca con `data-step-actions-spacer`.
 */
function gapAtEnd(fixed: Locator, last: 'main' | 'before-spacer'): Promise<number> {
  return fixed.evaluate((element, mode) => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    let box: Element | null = element;
    while (box && getComputedStyle(box).position !== 'fixed') box = box.parentElement;
    const content =
      mode === 'main'
        ? document.querySelector('main')?.lastElementChild
        : document.querySelector('main [data-step-actions-spacer]')?.previousElementSibling;
    if (!box || !content) return Number.NaN;
    return box.getBoundingClientRect().top - content.getBoundingClientRect().bottom;
  }, last);
}

test('WEB-25 WEB-27 a 390 px, al final de una página con pestañas, lo último queda a 20 px de la barra, como Screen en la app móvil', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.addStyleTag({ content: HIDE_DEV_INDICATOR });
  // Inicio es más alto que la ventana.
  await expect(page.getByText('Pago de la comida')).toBeVisible();
  const tabs = page.getByRole('navigation', { name: 'Principal' });
  expect(await gapAtEnd(tabs, 'main')).toBeCloseTo(20, 0);
});

test('WEB-25 WEB-30 a 390 px, al final de un paso, lo último queda a 20 px del pie fijo, como Screen en la app móvil', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.addStyleTag({ content: HIDE_DEV_INDICATOR });
  await page.goto('/transfers/new');
  await page.getByRole('button', { name: /^Luis/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: '¿Cuánto envías?' })).toBeVisible();
  // Una ventana más baja que cada paso; con una acción y con dos apiladas.
  await page.setViewportSize({ width: 390, height: 480 });
  const continueButton = page.getByRole('button', { name: 'Continuar' });
  expect(await gapAtEnd(continueButton, 'before-spacer')).toBeCloseTo(20, 0);

  await page.getByLabel('Monto').fill('1250');
  await page.getByLabel('Concepto').fill('Renta');
  await page.getByLabel('Referencia').fill('1');
  await continueButton.click();
  await page.getByRole('button', { name: 'Enviar' }).click();
  await expect(page.getByRole('region', { name: 'Comprobante' })).toBeVisible();
  const another = page.getByRole('button', { name: 'Hacer otra transferencia' });
  expect(await gapAtEnd(another, 'before-spacer')).toBeCloseTo(20, 0);
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

for (const width of [390, 320] as const) {
  test(`WEB-27 WEB-28 a ${width} px con el texto al 200 % las cuatro pestañas caben, se pueden tocar y no tapan el contenido`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await login(page);
    await page.addStyleTag({
      content: `html { font-size: 200% !important; } ${HIDE_DEV_INDICATOR}`,
    });
    const nav = page.getByRole('navigation', { name: 'Principal' });
    const tabs = nav.getByRole('link');
    await expect(tabs).toHaveCount(4);
    // La barra crece con el texto y publica su alto real para que el contenido lo reserve.
    await expect
      .poll(async () => {
        const reserved = await page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--tab-bar-height'),
        );
        const list = await nav.getByRole('list').boundingBox();
        return Math.abs(Number.parseInt(reserved, 10) - Math.round(list?.height ?? 0)) <= 1;
      })
      .toBe(true);
    for (const tab of await tabs.all()) {
      const name = (await tab.textContent()) ?? '';
      const state = await tab.evaluate((link) => {
        const box = link.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(link.lastElementChild ?? link);
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        const right = document.documentElement.clientWidth;
        return {
          onScreen:
            box.left >= -0.5 &&
            box.right <= right + 0.5 &&
            box.top >= -0.5 &&
            box.bottom <= window.innerHeight + 0.5,
          labelVisible: [...range.getClientRects()].every(
            (rect) =>
              rect.left >= box.left - 1 &&
              rect.right <= box.right + 1 &&
              rect.right <= right + 0.5 &&
              rect.bottom <= window.innerHeight + 0.5,
          ),
          tappable: hit !== null && link.contains(hit),
        };
      });
      expect(state, name).toEqual({ onScreen: true, labelVisible: true, tappable: true });
    }
    // El contenido reserva al menos el alto real de la barra (no el del token, que se queda corto).
    const bar = await nav.boundingBox();
    const reserved = await page
      .getByRole('main')
      .evaluate(
        (main) =>
          main.getBoundingClientRect().bottom -
          (main.lastElementChild ?? main).getBoundingClientRect().bottom,
      );
    expect(reserved).toBeGreaterThanOrEqual(bar?.height ?? Number.POSITIVE_INFINITY);
    // Al final de la página, lo último del contenido queda arriba de la barra.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const barTop = (await nav.boundingBox())?.y ?? 0;
    expect(await contentBottom(page)).toBeLessThanOrEqual(barTop + 0.5);
    await nav.getByRole('link', { name: 'Beneficiarios' }).click();
    await page.waitForURL((url) => url.pathname === '/beneficiaries');
  });
}

for (const balances of ['ok', 'large'] as const) {
  for (const width of [320, 390] as const) {
    test(`WEB-24 WEB-29 a ${width} px el tipo del movimiento no pasa por debajo del monto, que sigue al lado${balances === 'large' ? ' con saldos de siete cifras' : ''}`, async ({
      page,
    }) => {
      await scenario(page, { movements: balances });
      await page.setViewportSize({ width, height: 900 });
      await login(page);
      await page.goto(`/accounts/${PRINCIPAL_ID}/movements`);
      const rows = page.getByRole('region', { name: 'Movimientos' }).getByRole('listitem');
      await expect(rows).toHaveCount(5);
      if (balances === 'large') await expect(rows.first()).toContainText('Saldo $1,250,000.00');
      for (const row of await rows.all()) {
        const layout = await row.evaluate((item) => {
          const [, text, amount] = [...item.children];
          if (!text || !amount) return { beside: false, apart: false };
          const textBox = text.getBoundingClientRect();
          const amountBox = amount.getBoundingClientRect();
          // Lo que pinta la columna del texto: el renglón truncado se recorta en su caja; los demás
          // pueden desbordarla, así que se miden sus caracteres (sin el texto solo para lectores de
          // pantalla, que `sr-only` recorta a 1 px).
          const textRight = Math.max(
            ...[...text.children].map((line) => {
              if (getComputedStyle(line).overflowX !== 'visible') {
                return line.getBoundingClientRect().right;
              }
              const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
              let right = 0;
              for (let node = walker.nextNode(); node; node = walker.nextNode()) {
                if (node.parentElement?.closest('.sr-only')) continue;
                const range = document.createRange();
                range.selectNodeContents(node);
                for (const rect of range.getClientRects()) right = Math.max(right, rect.right);
              }
              return right;
            }),
          );
          return {
            // En la misma línea de la fila: las cajas se cruzan en vertical y el monto va a la derecha.
            beside:
              textBox.top < amountBox.bottom &&
              amountBox.top < textBox.bottom &&
              amountBox.left >= textBox.right - 0.5,
            apart: textRight <= amountBox.left + 0.5,
          };
        });
        expect(layout, (await row.textContent()) ?? '').toEqual({ beside: true, apart: true });
      }
    });
  }
}
