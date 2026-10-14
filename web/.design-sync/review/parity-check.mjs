#!/usr/bin/env node
// Captura cada pareja (web y móvil a 390×844, sin el margen de la tarjeta) y mide la proporción de
// píxeles distintos. Guía para la revisión de paridad (WEB-25), no una prueba binaria: las
// diferencias de suavizado del texto son esperables.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const tools = createRequire(resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '.ds-sync', 'package.json'));
const { chromium } = tools('playwright');
const { PNG } = tools('pngjs');
const pixelmatch = tools('pixelmatch').default ?? tools('pixelmatch');

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const base = arg('base', 'http://127.0.0.1:4310');
const out = resolve(arg('out', '.design-sync/.cache/parity'));
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const headerOf = async (app) => JSON.parse(/@ds-bundle: (\{.*?\}) \*\//.exec(await (await fetch(`${base}/${app}/_ds_bundle.js`)).text())[1]);
const htmlOf = (h, name) => h.components.find((c) => c.name === name).sourcePath.replace(/\.jsx$/, '.html');
const storiesOf = async (url) => { await page.goto(`${url}?story=__probe__`); return page.evaluate(() => window.__dsCells ?? []); };
const shot = async (url, file) => {
  await page.goto(url);
  // `.ds-single` lleva transform (para que una celda contenga lo fijo); en la captura de teléfono lo
  // quitamos para que lo `fixed` (barra de pestañas, acciones del paso) quede abajo del viewport.
  await page.addStyleTag({ content: 'body{padding:0 !important}.ds-single{transform:none !important}' });
  await page.waitForFunction(() => document.getElementById('r0')?.childElementCount > 0);
  // `fonts.ready` resuelve al instante si ninguna fuente empezó a cargar: forzamos el layout (que
  // pide las de Work Sans) y esperamos a que terminen antes de capturar.
  await page.waitForFunction(() => document.body.getBoundingClientRect() && document.fonts.status === 'loaded');
  // Fuentes listas y dos cuadros pintados: la captura sale del layout final sin una espera fija.
  await page.evaluate(() => document.fonts.ready.then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
  await page.screenshot({ path: file });
  return PNG.sync.read(readFileSync(file));
};

const webUrl = `${base}/web/${htmlOf(await headerOf('web'), 'AppShell')}`;
const mobileUrl = `${base}/mobile/${htmlOf(await headerOf('mobile'), 'Screen')}`;
const mobileStories = new Set(await storiesOf(mobileUrl));
const pairs = (await storiesOf(webUrl)).filter((s) => mobileStories.has(s));
const report = [];
for (const story of pairs) {
  const a = await shot(`${webUrl}?story=${story}`, join(out, `${story}-web.png`));
  const b = await shot(`${mobileUrl}?story=${story}`, join(out, `${story}-mobile.png`));
  const diff = new PNG({ width: a.width, height: a.height });
  const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.15 });
  writeFileSync(join(out, `${story}-diff.png`), PNG.sync.write(diff));
  report.push({ story, diffRatio: Number((changed / (a.width * a.height)).toFixed(4)) });
}
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
console.table(report);
await browser.close();
