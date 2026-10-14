#!/usr/bin/env node
// Servidor local de revisión del rediseño: sirve los bundles de design-sync de la web y de la app
// móvil bajo un mismo origen (/web/* y /mobile/*), para que el lienzo de paridad pueda superponer y
// medir ambos marcos. Uso: node serve.mjs --web <dir> --mobile <dir> [--port 4310]
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const roots = { web: resolve(arg('web', 'web/ds-bundle')), mobile: resolve(arg('mobile', 'mobile/ds-bundle')) };
// Sin la barra final que deja `new URL('.')`: con ella, `base + sep` terminaba en "//" y la guarda de
// abajo respondía 403 a todo lo que se sirve desde aquí (p. ej. /parity.html).
const here = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number.parseInt(arg('port', '4310'), 10);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const [, first, ...rest] = path.split('/');
  const base = first === 'web' || first === 'mobile' ? roots[first] : here;
  const relative = first === 'web' || first === 'mobile' ? rest.join('/') : [first, ...rest].join('/');
  const file = normalize(join(base, relative || 'index.html'));
  if (!file.startsWith(base + sep) && file !== base) { res.writeHead(403).end(); return; }
  if (!existsSync(file) || !statSync(file).isFile()) { res.writeHead(404).end('not found'); return; }
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
  createReadStream(file).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log(`revisión en http://127.0.0.1:${port}/  (web: /web/.canvas.html, móvil: /mobile/.canvas.html, paridad: /parity.html)`);
});
