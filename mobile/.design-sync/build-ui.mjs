/*
 * Empaqueta el sistema de diseño móvil para design-sync (Claude Design) sin tocar la app: escribe
 * en .design-sync/.cache/pkg un paquete con dist/index.mjs (lo que exporta entry.ts) y sus .d.ts.
 * Claude Design renderiza en el navegador, así que `react-native` se resuelve a react-native-web y
 * se prefieren los archivos .web.* de las dependencias, igual que en Expo para web.
 * design-sync lo consume con --entry .design-sync/.cache/pkg/dist/index.mjs.
 *
 * Se ejecuta desde mobile/: node .design-sync/build-ui.mjs
 * Requiere el convertidor preparado en .ds-sync/ con react-native-web instalado (ver NOTES.md);
 * react-native-web no es dependencia de la app.
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
      name: 'wallet-mobile-ui',
      version: appPkg.version,
      private: true,
      description: 'Componentes de la app móvil de TreoWallet (React Native, renderizados con react-native-web).',
      type: 'module',
      module: './dist/index.mjs',
      types: './dist/index.d.ts',
    },
    null,
    2,
  ) + '\n',
);

// 1. JS: los componentes reales con react-native -> react-native-web. React queda externo.
const esbuild = fromTools('esbuild');
const reactNativeWeb = dirname(fromTools.resolve('react-native-web/package.json'));
await esbuild.build({
  entryPoints: [join(here, 'entry.ts')],
  outfile: join(dist, 'index.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  tsconfig: join(app, 'tsconfig.json'),
  alias: { 'react-native': reactNativeWeb },
  resolveExtensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
  mainFields: ['browser', 'module', 'main'],
  define: { __DEV__: 'false', 'process.env.NODE_ENV': '"production"' },
  external: ['react', 'react/*', 'react-dom', 'react-dom/*'],
  logLevel: 'warning',
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
    const rel = relative(dirname(file), join(types, 'src', target)).split('\\').join('/');
    return q + (rel.startsWith('.') ? rel : `./${rel}`) + q;
  });
  writeFileSync(file, text);
}
writeFileSync(join(dist, 'index.d.ts'), "export * from './types/.design-sync/entry';\n");

console.error(`wallet-mobile-ui -> ${relative(app, pkg)} (dist/index.mjs, dist/index.d.ts)`);
