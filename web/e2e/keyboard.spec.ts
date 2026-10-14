import { expect, test, type Locator, type Page } from '@playwright/test';
import { login, scenario } from './support';

/** Tab hasta que `target` tiene el foco. */
async function tabUntil(page: Page, target: Locator) {
  for (let i = 0; i < 40; i += 1) {
    await page.keyboard.press('Tab');
    if (await target.evaluate((el) => el === document.activeElement)) return;
  }
  throw new Error('El foco no llegó al control con Tab');
}

/** Tab hasta `target`; en botones y enlaces el foco debe verse (WEB-23). */
async function tabTo(page: Page, target: Locator) {
  await tabUntil(page, target);
  const { tag, outline } = await target.evaluate((el) => ({
    tag: el.tagName,
    outline: getComputedStyle(el).outlineStyle,
  }));
  if (tag === 'A' || tag === 'BUTTON') expect(outline).not.toBe('none');
}

for (const width of [390, 1280] as const) {
  test(`WEB-23 WEB-30 a ${width} px la transferencia llega al comprobante solo con el teclado`, async ({
    page,
  }) => {
    await scenario(page, {});
    await page.setViewportSize({ width, height: width === 390 ? 844 : 800 });
    await login(page);
    await page.goto('/transfers/new');
    await tabTo(page, page.getByRole('button', { name: /^Luis/ }));
    await page.keyboard.press('Enter');
    await tabTo(page, page.getByLabel('Monto'));
    await page.keyboard.type('1250');
    await tabTo(page, page.getByLabel('Concepto'));
    await page.keyboard.type('Renta');
    await tabTo(page, page.getByLabel('Referencia'));
    await page.keyboard.type('1');
    await tabTo(page, page.getByRole('button', { name: 'Continuar' }));
    await page.keyboard.press('Enter');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Revisa tu transferencia' }),
    ).toBeFocused();
    await tabTo(page, page.getByRole('button', { name: 'Enviar' }));
    await page.keyboard.press('Space');
    await expect(page.getByRole('region', { name: 'Comprobante' })).toBeVisible();
  });

  test(`WEB-23 a ${width} px con el teclado el anillo de foco de la tarjeta de cuenta rodea toda la tarjeta`, async ({
    page,
  }) => {
    await scenario(page, {});
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    const card = page.getByRole('article', { name: 'Ahorro' });
    const select = card.getByRole('button', { name: 'Ahorro', exact: true });
    // Su anillo no está en el botón sino en el `::after` que cubre la tarjeta (se mide abajo).
    await tabUntil(page, select);
    expect(await select.evaluate((el) => el.matches(':focus-visible'))).toBe(true);
    const ring = await select.evaluate((button) => {
      const after = getComputedStyle(button, '::after');
      // El `::after` se posiciona contra el primer ancestro posicionado: debe ser la tarjeta.
      let holder = button.parentElement;
      while (holder && getComputedStyle(holder).position === 'static')
        holder = holder.parentElement;
      const focus = getComputedStyle(document.documentElement)
        .getPropertyValue('--dt-focus')
        .trim();
      const probe = document.createElement('span');
      probe.style.color = focus;
      document.body.append(probe);
      const focusColor = getComputedStyle(probe).color;
      probe.remove();
      return {
        holder: holder?.tagName,
        position: after.position,
        inset: [after.top, after.right, after.bottom, after.left],
        outline: `${after.outlineStyle} ${after.outlineWidth}`,
        colorMatches: after.outlineColor === focusColor,
        buttonOutline: getComputedStyle(button).outlineStyle,
      };
    });
    expect(ring).toEqual({
      holder: 'ARTICLE',
      position: 'absolute',
      inset: ['-2px', '-2px', '-2px', '-2px'],
      outline: 'solid 2px',
      colorMatches: true,
      // Un solo anillo: el del nombre se apaga y lo lleva el `::after` que cubre la tarjeta.
      buttonOutline: 'none',
    });
    // El `::after` cubre toda la tarjeta: sus esquinas opuestas (en el relleno) son del botón.
    const box = await card.boundingBox();
    expect(box).toBeTruthy();
    if (!box) return;
    const hits = await page.evaluate(
      ({ points }) =>
        points.map(([x, y]) => document.elementFromPoint(x ?? 0, y ?? 0)?.textContent?.trim()),
      {
        points: [
          [box.x + box.width - 12, box.y + 4],
          [box.x + 12, box.y + box.height - 4],
        ],
      },
    );
    expect(hits).toEqual(['Ahorro', 'Ahorro']);
    // Con el mouse el anillo no aparece (solo con `:focus-visible`). Primero el foco sale de la
    // tarjeta: un clic sobre el control que ya tiene el foco del teclado lo deja `:focus-visible`.
    await page.getByRole('heading', { name: 'Saldo total' }).click();
    await expect(select).not.toBeFocused();
    await page.mouse.click(box.x + 12, box.y + box.height - 4);
    await expect(select).toBeFocused();
    expect(await select.evaluate((el) => el.matches(':focus-visible'))).toBe(false);
    expect(await select.evaluate((el) => getComputedStyle(el, '::after').outlineStyle)).toBe(
      'none',
    );
  });
}
