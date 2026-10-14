#!/usr/bin/env node
// Paridad sobre las pantallas reales (WEB-25, tarea 8.1 del rediseño).
//   --phase approved  Antes de reconstruir los lienzos: captura las historias aprobadas (web `AppShell` a
//                     390×844 y 1280×800, móvil `Screen` a 390×844), en ventana y en página completa.
//   --phase real      Captura la web real (next dev contra la API simulada) recorriendo cada estado como una
//                     persona, y las vistas reales de la app móvil (las historias de `Screen` ya las usan), y
//                     compara: A web real↔aprobada a 390, B a 1280, C móvil real↔aprobada, D web real↔móvil real.
// `ratio` es una guía (Work Sans variable en la web y TTF estáticos en móvil): se revisa cada -diff.png con la
// regla de veredicto de NOTES.md ("Paridad").
// Fuente: la app (next/font/local) y el lienzo (.design-sync/fonts.css) usan el mismo archivo versionado,
// app/fonts/WorkSans-latin.woff2, así que A/B no dependen de lo que Google Fonts entregue a cada navegador
// (la tarea 8.1 necesitaba una opción --font canvas para eso; ya no existe y el script no usa la red).
// D completa compara las dos como un teléfono tan alto como su contenido (`-tall.png`, ver `shoot`).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const tools = createRequire(resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '.ds-sync', 'package.json'));
const { chromium } = tools('playwright');
const { PNG } = tools('pngjs');
const pixelmatch = tools('pixelmatch').default ?? tools('pixelmatch');

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback; };
const phase = arg('phase', 'real');
const base = arg('base', 'http://127.0.0.1:4310');
const app = arg('app', 'http://127.0.0.1:3101');
const api = arg('api', 'http://127.0.0.1:4999');
const out = resolve(arg('out', '.design-sync/.cache/parity-real'));
const NOW = new Date('2026-10-13T18:00:00Z');
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 800 };
const PRINCIPAL = '0b9a4f8e-1c2d-4e5f-8a9b-0c1d2e3f4a51';
const SENT = '7f1c2a8e-5a0b-4c4e-9a59-8f0e1c2d3b4a';
for (const dir of ['approved', 'real', 'diff']) mkdirSync(join(out, dir), { recursive: true });

const browser = await chromium.launch();
const headerOf = async (bundle) => JSON.parse(/@ds-bundle: (\{.*?\}) \*\//.exec(await (await fetch(`${base}/${bundle}/_ds_bundle.js`)).text())[1]);
const htmlOf = (header, name) => header.components.find((c) => c.name === name).sourcePath.replace(/\.jsx$/, '.html');
const webCanvas = `${base}/web/${htmlOf(await headerOf('web'), 'AppShell')}`;
const mobileCanvas = `${base}/mobile/${htmlOf(await headerOf('mobile'), 'Screen')}`;

const painted = (page) => page.evaluate(() => document.fonts.ready.then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));

/**
 * Fuentes listas y dos cuadros pintados; luego ventana y página completa. Con `tall`, además
 * `-tall.png`: la pantalla como un teléfono tan alto como su contenido (lo fijo abajo queda al final),
 * la página completa que sirve para comparar la web con la app móvil (D completa).
 */
async function shoot(page, dir, name, tall) {
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await painted(page);
  const { width } = page.viewportSize();
  await page.screenshot({ path: join(out, dir, `${name}-${width}.png`) });
  await page.screenshot({ path: join(out, dir, `${name}-${width}-full.png`), fullPage: true });
  if (!tall) return;
  await tall(page);
  await painted(page);
  await page.screenshot({ path: join(out, dir, `${name}-${width}-tall.png`) });
}

/**
 * Web: la ventana crece hasta el alto del documento. En la página completa de Chromium lo `fixed`
 * (pestañas, pie del paso) se queda donde estaba la ventana; aquí baja al final, como en la app.
 */
async function tallWeb(page) {
  const { width, height } = page.viewportSize();
  const content = await page.evaluate(() => document.documentElement.scrollHeight);
  if (content > height) await page.setViewportSize({ width, height: content });
}

/**
 * Móvil: la pantalla se desplaza dentro de su ScrollView, en el marco fijo de 390×844; el marco (y
 * las celdas que lo contienen) crece lo que le falta al contenido.
 */
async function tallPhone(page) {
  const extra = await page.evaluate(() => {
    const scroller = [...document.querySelectorAll('#r0 div')].find((el) => {
      const { overflowY } = getComputedStyle(el);
      return (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
    });
    if (!scroller) return 0;
    const missing = scroller.scrollHeight - scroller.clientHeight;
    for (let el = scroller.parentElement; el && el !== document.body; el = el.parentElement) {
      if (Math.round(el.getBoundingClientRect().height) === 844) el.style.height = `${844 + missing}px`;
    }
    return missing;
  });
  if (extra > 0) await page.setViewportSize({ width: 390, height: 844 + extra });
}

async function storiesOf(url) {
  const page = await browser.newPage();
  await page.goto(`${url}?story=__probe__`);
  const list = await page.evaluate(() => window.__dsCells ?? []);
  await page.close();
  return list;
}

async function canvasShot(url, story, dir, name, size, tall) {
  const page = await browser.newPage({ viewport: size });
  await page.goto(`${url}?story=${story}`);
  // Sin el margen de la celda ni el transform de `.ds-single`: lo fijo queda abajo de la ventana.
  await page.addStyleTag({ content: 'body{padding:0 !important}.ds-single{transform:none !important}' });
  await page.waitForFunction(() => document.getElementById('r0')?.childElementCount > 0);
  await shoot(page, dir, name, tall);
  await page.close();
}

const scenario = (value) => fetch(`${api}/__scenario`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value ?? {}) });

async function newPage(size, signedIn) {
  const context = await browser.newContext({ viewport: size });
  const page = await context.newPage();
  await page.clock.setFixedTime(NOW);
  if (signedIn) {
    // Sin red pendiente: el formulario ya está hidratado (antes, el envío nativo mandaba un GET).
    await page.goto(`${app}/login`, { waitUntil: 'networkidle' });
    await page.getByLabel('Correo').fill('ana@example.com');
    await page.getByLabel('Contraseña').fill('Ana-demo-2026!');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
    await page.waitForURL((url) => url.pathname === '/');
  }
  return page;
}

const blur = (page) => page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
async function toAmount(page, amount) {
  await page.goto(`${app}/transfers/new`);
  await page.getByRole('button', { name: /^Luis/ }).click();
  await page.getByLabel('Monto').fill(amount);
  await page.getByLabel('Concepto').fill('Renta');
  await page.getByLabel('Referencia').fill('1');
}
async function toReview(page, amount) {
  await toAmount(page, amount);
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('heading', { level: 1, name: 'Revisa tu transferencia' }).waitFor();
}
async function send(page) {
  await page.getByRole('button', { name: 'Enviar' }).click();
}
const text = (page, value) => page.getByText(value).first().waitFor({ timeout: 15_000 });

/** Cada historia web: cómo llegar a ese estado en la app real. */
const RECIPES = {
  Login: { public: true, go: (p) => p.goto(`${app}/login`) },
  Register: { public: true, go: (p) => p.goto(`${app}/register`) },
  VerifyEmail: { public: true, go: (p) => p.goto(`${app}/verify-email?email=ana%40example.com&registered=1`) },
  Home: { go: async (p) => { await p.goto(`${app}/`); await text(p, 'Pago de la comida'); } },
  HomeEmpty: { scenario: { accounts: 'empty' }, go: async (p) => { await p.goto(`${app}/`); await text(p, 'Aún no tienes cuentas'); } },
  HomeLoading: { scenario: { accounts: 'hang' }, go: async (p) => { await p.goto(`${app}/`, { waitUntil: 'domcontentloaded' }); await text(p, 'Cargando tus cuentas'); } },
  HomeError: { go: async (p) => { await p.route('**/bff/api/accounts', (route) => route.abort()); await p.goto(`${app}/`); await text(p, 'No pudimos cargar tus cuentas'); } },
  Movements: { go: async (p) => { await p.goto(`${app}/accounts/${PRINCIPAL}/movements`); await text(p, 'Cargar más'); } },
  MovementsEmpty: { go: async (p) => { await RECIPES.Movements.go(p); await p.getByRole('button', { name: 'Filtros' }).click(); await p.getByLabel('Desde').fill('2026-10-01'); await p.getByRole('button', { name: 'Aplicar' }).click(); await text(p, 'No hay movimientos en este periodo'); } },
  // Con teclado, como en el lienzo: el foco llega a "Cerrar" con su anillo visible (:focus-visible).
  MovementsFilters: { go: async (p) => { await RECIPES.Movements.go(p); await p.getByRole('button', { name: 'Filtros' }).focus(); await p.keyboard.press('Enter'); await p.getByRole('dialog', { name: 'Filtrar movimientos' }).waitFor(); } },
  TransferRecipient: { go: async (p) => { await p.goto(`${app}/transfers/new`); await text(p, 'Tus cuentas'); } },
  TransferAmount: { go: async (p) => { await toAmount(p, '1250.00'); await blur(p); } },
  TransferReview: { go: async (p) => { await toReview(p, '1250.00'); await blur(p); } },
  TransferUncertain: { go: async (p) => { await toReview(p, '1250.00'); await p.route('**/transfers/new', (route) => (route.request().method() === 'POST' ? route.abort() : route.continue())); await send(p); await text(p, 'No pudimos confirmar el estado de tu transferencia'); await blur(p); } },
  TransferRejected: { go: async (p) => { await toReview(p, '30000.00'); await send(p); await text(p, 'No tienes saldo suficiente para esta transferencia.'); await blur(p); } },
  TransferOtp: { go: async (p) => { await toReview(p, '15000.00'); await send(p); await p.getByLabel('Código de 6 dígitos').fill('482913'); await blur(p); } },
  TransferCompleted: { go: async (p) => { await toReview(p, '1250.00'); await send(p); await text(p, 'Completada'); await blur(p); } },
  TransferFailed: { go: async (p) => { await toReview(p, '15000.00'); await send(p); await p.getByLabel('Código de 6 dígitos').fill('000000'); await p.getByRole('button', { name: 'Confirmar' }).click(); await text(p, 'Fallida'); await blur(p); } },
  Beneficiaries: { go: async (p) => { await p.goto(`${app}/beneficiaries`); await text(p, 'María Gómez'); } },
  BeneficiariesEmpty: { scenario: { beneficiaries: 'empty' }, go: async (p) => { await p.goto(`${app}/beneficiaries`); await text(p, 'Aún no tienes beneficiarios'); } },
  NewBeneficiary: { go: async (p) => { await p.goto(`${app}/beneficiaries/new`); await text(p, 'Nombre del titular'); } },
  TransferDetail: { go: async (p) => { await p.goto(`${app}/transfers/${SENT}`); await text(p, 'Completada'); } },
};

function compare(a, b, diffName) {
  if (!existsSync(a) || !existsSync(b)) return null;
  const A = PNG.sync.read(readFileSync(a));
  const B = PNG.sync.read(readFileSync(b));
  const width = Math.min(A.width, B.width);
  const height = Math.min(A.height, B.height);
  const crop = (img) => { const c = new PNG({ width, height }); PNG.bitblt(img, c, 0, 0, width, height, 0, 0); return c; };
  const diff = new PNG({ width, height });
  const changed = pixelmatch(crop(A).data, crop(B).data, diff.data, width, height, { threshold: 0.15 });
  writeFileSync(join(out, 'diff', diffName), PNG.sync.write(diff));
  return { ratio: Number((changed / (width * height)).toFixed(4)), heights: `${A.height}/${B.height}` };
}

const webStories = await storiesOf(webCanvas);
const mobileStories = await storiesOf(mobileCanvas);

if (phase === 'approved') {
  for (const story of webStories) {
    await canvasShot(webCanvas, story, 'approved', `${story}-web`, PHONE);
    await canvasShot(webCanvas, story, 'approved', `${story}-web`, DESKTOP);
  }
  for (const story of mobileStories) await canvasShot(mobileCanvas, story, 'approved', `${story}-mobile`, PHONE);
} else {
  for (const story of webStories) {
    const recipe = RECIPES[story];
    if (!recipe) { console.warn(`Sin receta para ${story}`); continue; }
    for (const size of [PHONE, DESKTOP]) {
      await scenario(recipe.scenario);
      const page = await newPage(size, !recipe.public);
      await recipe.go(page);
      // Sin el indicador de next dev; el puntero sale del botón donde lo dejó el último clic (en el
      // lienzo nada tiene hover) y sin transiciones a medias.
      await page.addStyleTag({ content: 'nextjs-portal{display:none !important}*,*::before,*::after{transition:none !important}' });
      await page.mouse.move(0, 0);
      await shoot(page, 'real', `${story}-web`, size === PHONE ? tallWeb : undefined);
      await page.context().close();
    }
  }
  await scenario({});
  for (const story of mobileStories) await canvasShot(mobileCanvas, story, 'real', `${story}-mobile`, PHONE, tallPhone);
  const file = (dir, name) => join(out, dir, name);
  const report = [...new Set([...webStories, ...mobileStories])].map((story) => ({
    story,
    A390: compare(file('real', `${story}-web-390.png`), file('approved', `${story}-web-390.png`), `${story}-A390.png`),
    A390full: compare(file('real', `${story}-web-390-full.png`), file('approved', `${story}-web-390-full.png`), `${story}-A390full.png`),
    B1280: compare(file('real', `${story}-web-1280.png`), file('approved', `${story}-web-1280.png`), `${story}-B1280.png`),
    B1280full: compare(file('real', `${story}-web-1280-full.png`), file('approved', `${story}-web-1280-full.png`), `${story}-B1280full.png`),
    C390: compare(file('real', `${story}-mobile-390.png`), file('approved', `${story}-mobile-390.png`), `${story}-C390.png`),
    C390full: compare(file('real', `${story}-mobile-390-full.png`), file('approved', `${story}-mobile-390-full.png`), `${story}-C390full.png`),
    D390: compare(file('real', `${story}-web-390.png`), file('real', `${story}-mobile-390.png`), `${story}-D390.png`),
    // La pareja en página completa: las dos como un teléfono tan alto como su contenido (`-tall`).
    D390full: compare(file('real', `${story}-web-390-tall.png`), file('real', `${story}-mobile-390-tall.png`), `${story}-D390full.png`),
  }));
  writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.table(report.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v && typeof v === 'object' ? v.ratio : v]))));
}
await browser.close();
