/*
 * Empaqueta el sistema de diseño de la web para design-sync (Claude Design) sin tocar la app:
 * escribe en .design-sync/.cache/pkg un paquete con dist/index.mjs (los componentes de entry.ts),
 * sus .d.ts y dist/styles.css (Tailwind compilado desde tailwind.css). design-sync lo consume con
 * --entry .design-sync/.cache/pkg/dist/index.mjs.
 *
 * Se ejecuta desde web/: node .design-sync/build-ui.mjs
 * Requiere el convertidor preparado en .ds-sync/ (de ahí sale esbuild; ver NOTES.md).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '..');
const pkg = join(here, '.cache', 'pkg');
const dist = join(pkg, 'dist');
const fromApp = createRequire(join(app, 'package.json'));
const fromTools = createRequire(join(app, '.ds-sync', 'package.json'));

rmSync(pkg, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

const appPkg = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8'));
writeFileSync(
  join(pkg, 'package.json'),
  JSON.stringify(
    {
      name: 'wallet-web-ui',
      version: appPkg.version,
      private: true,
      description: 'Componentes de la web de TreoWallet (React DOM + Tailwind v4).',
      type: 'module',
      module: './dist/index.mjs',
      types: './dist/index.d.ts',
      sideEffects: ['*.css'],
      // design-sync detecta aquí el paquete de tokens (sus archivos se copian a tokens/).
      dependencies: Object.fromEntries(
        Object.entries(appPkg.dependencies).filter(([name]) =>
          ['@devchrisvaz/wallet-design-tokens', '@devchrisvaz/wallet-contract', 'react', 'react-dom'].includes(name),
        ),
      ),
    },
    null,
    2,
  ) + '\n',
);

// 1. JS: los componentes reales, con los alias @/ de tsconfig. React queda externo.
const esbuild = fromTools('esbuild');
await esbuild.build({
  entryPoints: [join(here, 'entry.ts')],
  outfile: join(dist, 'index.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  tsconfig: join(app, 'tsconfig.json'),
  external: ['react', 'react/*', 'react-dom', 'react-dom/*'],
  logLevel: 'warning',
  logOverride: { 'module-level-directive': 'silent' },
});

// 2. Tipos: tsc de la propia app solo sobre entry.ts; después los alias @/ pasan a rutas relativas.
const types = join(dist, 'types');
const dtsConfig = join(pkg, 'tsconfig.dts.json');
writeFileSync(
  dtsConfig,
  JSON.stringify({
    extends: join(app, 'tsconfig.json'),
    compilerOptions: {
      noEmit: false,
      declaration: true,
      emitDeclarationOnly: true,
      incremental: false,
      rootDir: app,
      outDir: types,
      plugins: [],
    },
    files: [join(here, 'entry.ts')],
    include: [],
  }),
);
execFileSync(process.execPath, [fromApp.resolve('typescript/bin/tsc'), '-p', dtsConfig], {
  stdio: 'inherit',
});
const walk = (d) =>
  readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
for (const file of walk(types).filter((f) => f.endsWith('.d.ts'))) {
  const text = readFileSync(file, 'utf8').replace(/(['"])@\/([^'"]+)\1/g, (_, q, target) => {
    const rel = relative(dirname(file), join(types, target)).split('\\').join('/');
    return q + (rel.startsWith('.') ? rel : `./${rel}`) + q;
  });
  writeFileSync(file, text);
}
writeFileSync(join(dist, 'index.d.ts'), "export * from './types/.design-sync/entry';\n");

// 3. CSS: el globals.css de la app compilado con Tailwind (el mismo plugin de PostCSS que usa Next).
const postcss = fromApp('postcss');
const tailwind = fromApp('@tailwindcss/postcss');
const input = join(here, 'tailwind.css');
const result = await postcss([tailwind({ base: app })]).process(readFileSync(input, 'utf8'), {
  from: input,
  to: join(dist, 'styles.css'),
});
writeFileSync(join(dist, 'styles.css'), result.css);

console.error(`wallet-web-ui -> ${relative(app, pkg)} (dist/index.mjs, dist/index.d.ts, dist/styles.css)`);
