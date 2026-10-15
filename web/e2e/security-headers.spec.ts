import { expect, test, type Page } from '@playwright/test';
import { PRIVATE_PATHS, PUBLIC_PATHS, login, scenario } from './support';

/*
 * WEB-38 y WEB-39 en un navegador real: la política de contenido no debe bloquear nada de lo que
 * la web usa, ni en `next dev` ni en la compilación de producción (`npm run test:e2e:prod`).
 */

/**
 * El indicador y el visor de errores de `next dev` (`next-devtools`) inyectan `<style>` sin nonce. No
 * existen en la compilación de producción, donde la misma prueba no tiene excepciones.
 */
const DEV_TOOLS = /next-devtools/;

const CSP_MESSAGE = /Content[- ]Security[- ]Policy|Refused to|violates the following/i;

interface Collected {
  messages: string[];
  violations: () => Promise<string[]>;
}

/** Registra los mensajes de consola de CSP y los eventos `securitypolicyviolation` de la página. */
async function collectViolations(page: Page): Promise<Collected> {
  const messages: string[] = [];
  page.on('console', (message) => {
    if (CSP_MESSAGE.test(message.text())) {
      messages.push(`${message.text()} (${message.location().url})`);
    }
  });
  page.on('pageerror', (error) => {
    if (CSP_MESSAGE.test(error.message)) messages.push(error.message);
  });
  await page.addInitScript(() => {
    const store: string[] = [];
    (window as unknown as { __cspViolations: string[] }).__cspViolations = store;
    document.addEventListener('securitypolicyviolation', (event) => {
      store.push(`${event.violatedDirective} ${event.blockedURI} ${event.sourceFile}`);
    });
  });
  return {
    get messages() {
      return messages.filter((text) => !DEV_TOOLS.test(text));
    },
    violations: async () =>
      (
        await page.evaluate(
          () => (window as unknown as { __cspViolations?: string[] }).__cspViolations ?? [],
        )
      ).filter((text) => !DEV_TOOLS.test(text)),
  };
}

test.beforeEach(async ({ page }) => {
  await scenario(page, {});
});

test('WEB-39 las pantallas públicas y las autenticadas cargan sin violaciones de la política de contenido', async ({
  page,
}) => {
  const collected = await collectViolations(page);
  const visit = async (path: string) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    expect(await collected.violations(), `eventos en ${path}`).toEqual([]);
    expect(collected.messages, `consola en ${path}`).toEqual([]);
  };

  for (const path of PUBLIC_PATHS) await visit(path);
  await login(page);
  for (const path of PRIVATE_PATHS) await visit(path);
});

test('WEB-39 el flujo de transferir (revisión y formulario) corre sin violaciones', async ({
  page,
}) => {
  const collected = await collectViolations(page);
  await login(page);
  await page.goto('/transfers/new');
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /Luis/ }).first().click();
  await page.waitForLoadState('networkidle');
  expect(await collected.violations()).toEqual([]);
  expect(collected.messages).toEqual([]);
});

test('WEB-39 cada página lleva una política con nonce distinto y los scripts de Next.js lo usan', async ({
  page,
}) => {
  const policies: string[] = [];
  for (let i = 0; i < 2; i += 1) {
    const response = await page.goto('/login');
    const policy = (await response?.headerValue('content-security-policy')) ?? '';
    policies.push(policy);
    const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
    expect(nonce).toBeTruthy();
    const scripts = await page.locator('script[nonce]').count();
    expect(scripts).toBeGreaterThan(0);
    // Los atributos `nonce` se ocultan en el DOM; se comparan con el elemento real.
    const matching = await page.evaluate(
      (value) => [...document.querySelectorAll('script')].some((s) => s.nonce === value),
      nonce,
    );
    expect(matching).toBe(true);
  }
  const nonces = policies.map((policy) => /'nonce-([^']+)'/.exec(policy)?.[1]);
  expect(nonces[0]).not.toBe(nonces[1]);
});

test('WEB-39 un manejador en línea sin nonce no se ejecuta y el navegador lo reporta', async ({
  page,
}) => {
  const collected = await collectViolations(page);
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => {
    document.body.insertAdjacentHTML('beforeend', '<img src="x" onerror="window.__ran = true">');
  });
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(() => (window as unknown as { __ran?: boolean }).__ran),
  ).toBeUndefined();
  expect((await collected.violations()).join('\n')).toMatch(/script-src/);
});

test('WEB-38 las páginas, las rutas del BFF y los archivos de _next llevan los headers de seguridad', async ({
  page,
}) => {
  const expected = {
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'strict-origin-when-cross-origin',
  };
  const check = (headers: Record<string, string>, label: string) => {
    for (const [name, value] of Object.entries(expected)) {
      expect(headers[name], `${name} en ${label}`).toBe(value);
    }
    expect(headers['permissions-policy'], `permissions-policy en ${label}`).toContain('camera=()');
    expect(headers['strict-transport-security'], `HSTS en ${label}`).toBeUndefined();
  };

  const document = await page.goto('/login');
  check((await document?.allHeaders()) ?? {}, '/login');
  expect(await document?.headerValue('content-security-policy')).toContain(
    "frame-ancestors 'none'",
  );

  const bff = await page.request.get('/bff/api/accounts');
  check(bff.headers(), '/bff/api/accounts');

  const scriptSrc = await page.locator('script[src]').first().getAttribute('src');
  expect(scriptSrc).toContain('/_next/');
  const asset = await page.request.get(scriptSrc ?? '');
  expect(asset.ok()).toBe(true);
  check(asset.headers(), scriptSrc ?? '_next');
});

test('WEB-38 WEB-06 con el Referrer-Policy vigente el inicio de sesión (Server Action) funciona', async ({
  page,
}) => {
  await login(page);
  await expect(page).toHaveURL(/\/$/);
});

test('WEB-38 la web no se puede incrustar en un iframe', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => {
    const frame = document.createElement('iframe');
    frame.id = 'intruso';
    frame.src = '/login';
    document.body.appendChild(frame);
  });
  await page.waitForTimeout(800);
  const embedded = page.frames().find((frame) => frame !== page.mainFrame());
  // Un marco bloqueado queda en la página de error del navegador, sin el formulario.
  expect(embedded?.url() ?? 'chrome-error://').toMatch(/^chrome-error:|^about:blank$/);
});
