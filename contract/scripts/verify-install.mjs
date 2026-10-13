#!/usr/bin/env node
// Verifica la distribución local (CTR-16): un proyecto nuevo instala el paquete con
// "file:<ruta>" e install-links=true, sin credenciales de ningún registro, y recibe una copia
// (no un enlace simbólico) con sus dependencias resueltas. Uso: node scripts/verify-install.mjs [directorio]
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const contractDir = resolve(process.argv[2] ?? '.');
const consumer = mkdtempSync(join(tmpdir(), 'wallet-contract-consumer-'));
const packageName = '@morgandevchrisvaz/wallet-contract';
const failures = [];

try {
  writeFileSync(
    join(consumer, 'package.json'),
    JSON.stringify({
      name: 'verify-install',
      private: true,
      dependencies: { [packageName]: `file:${contractDir}` },
    }),
  );
  writeFileSync(join(consumer, '.npmrc'), 'install-links=true\n');
  // Sin la configuración del usuario ni tokens: lo mismo que tendría un evaluador recién llegado.
  const emptyUserConfig = join(consumer, 'empty-user.npmrc');
  writeFileSync(emptyUserConfig, '');
  const env = { ...process.env, npm_config_userconfig: emptyUserConfig };
  delete env.NODE_AUTH_TOKEN;
  delete env.NPM_TOKEN;

  const install = spawnSync('npm', ['install', '--no-audit', '--no-fund'], {
    cwd: consumer,
    env,
    encoding: 'utf8',
  });
  if (install.status !== 0) failures.push(`npm install falló:\n${install.stderr}`);

  const installed = join(consumer, 'node_modules', packageName);
  if (!existsSync(installed)) {
    failures.push('el paquete no quedó instalado');
  } else {
    if (lstatSync(installed).isSymbolicLink()) {
      failures.push('el paquete es un enlace simbólico a la carpeta contract, no una copia');
    }
    const requireFromPackage = createRequire(join(installed, 'package.json'));
    for (const dependency of ['openapi-fetch', 'zod']) {
      try {
        requireFromPackage.resolve(dependency);
      } catch {
        failures.push(`la dependencia ${dependency} no se resuelve desde el paquete instalado`);
      }
    }
    const requireFromConsumer = createRequire(join(consumer, 'package.json'));
    if (requireFromConsumer(packageName).formatMXN('1250.50') !== '$1,250.50') {
      failures.push('el paquete instalado no funciona');
    }
  }
} finally {
  rmSync(consumer, { recursive: true, force: true });
}

if (failures.length > 0) {
  console.error(`verify:install falló:\n${failures.join('\n')}`);
  process.exit(1);
}

console.log('El paquete se instala como copia, sin credenciales y con sus dependencias resueltas.');
